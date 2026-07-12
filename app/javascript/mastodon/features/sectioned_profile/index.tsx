import { useEffect, useState, useCallback, useMemo } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { useParams, useLocation, useHistory } from 'react-router-dom';

import { List as ImmutableList } from 'immutable';

import { importFetchedStatuses, importFetchedAccount } from 'mastodon/actions/importer';
import { apiRequestGet } from 'mastodon/api';
import type { ApiProfileSectionJSON } from 'mastodon/api/profile_sections';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import type { ApiStatusJSON } from 'mastodon/api_types/statuses';
import Column from 'mastodon/components/column';
import { ColumnBackButton } from 'mastodon/components/column_back_button';
import StatusList from 'mastodon/components/status_list';
import { AccountHeader } from 'mastodon/features/account_timeline/components/account_header';
import { me } from 'mastodon/initial_state';
import { useAppDispatch } from 'mastodon/store';

const messages = defineMessages({
  title: { id: 'sectioned_profile.title', defaultMessage: 'Profile' },
});

type TabKey = 'me' | 'work' | 'timeline' | 'friendship';

const TAB_KEYS: TabKey[] = ['me', 'work', 'timeline', 'friendship'];

interface SectionWithStatuses extends ApiProfileSectionJSON {
  statusIds: ImmutableList<string>;
  loading: boolean;
}

const emptyList = ImmutableList<string>();

const noopLoadMore = () => undefined;

const isTabKey = (v: string | null): v is TabKey =>
  v !== null && (TAB_KEYS as string[]).includes(v);

export const SectionedProfile = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const { acct } = useParams<{ acct?: string }>();
  const location = useLocation();
  const history = useHistory();

  const [account, setAccount] = useState<ApiAccountJSON | null>(null);
  const [sections, setSections] = useState<SectionWithStatuses[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isOwner = account !== null && account.id === me;

  const activeTab: TabKey = useMemo(() => {
    const raw = new URLSearchParams(location.search).get('tab');
    return isTabKey(raw) ? raw : 'me';
  }, [location.search]);

  const setTab = useCallback(
    (tab: TabKey) => {
      const params = new URLSearchParams(location.search);
      if (tab === 'me') params.delete('tab');
      else params.set('tab', tab);
      const qs = params.toString();
      history.replace(`${location.pathname}${qs ? `?${qs}` : ''}`);
    },
    [history, location.pathname, location.search],
  );

  useEffect(() => {
    if (!acct) return;

    let cancelled = false;
    void (async () => {
      try {
        const accountRes = await apiRequestGet<ApiAccountJSON>('v1/accounts/lookup', { acct });
        if (cancelled) return;

        // Hydrate the account into Redux so AccountHeader can find it.
        dispatch(importFetchedAccount(accountRes));
        setAccount(accountRes);

        const sectionList = await apiRequestGet<ApiProfileSectionJSON[]>(
          `v1/accounts/${accountRes.id}/profile/sections`,
        );
        if (cancelled) return;

        const enriched: SectionWithStatuses[] = sectionList.map((s) => ({
          ...s,
          statusIds: emptyList,
          loading: true,
        }));
        setSections(enriched);

        await Promise.all(
          sectionList.map(async (s) => {
            const statuses = await apiRequestGet<ApiStatusJSON[]>(
              `v1/accounts/${accountRes.id}/profile/sections/${s.id}/statuses`,
              { limit: 20 },
            );
            if (cancelled) return;

            dispatch(importFetchedStatuses(statuses));

            setSections((prev) =>
              prev.map((row) =>
                row.id === s.id
                  ? {
                      ...row,
                      statusIds: ImmutableList(statuses.map((st) => st.id)),
                      loading: false,
                    }
                  : row,
              ),
            );
          }),
        );
      } catch (e: unknown) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [acct, dispatch]);

  const timelineSection = useMemo(
    () => sections.find((s) => s.section_type === 'timeline'),
    [sections],
  );
  const workSections = useMemo(
    () => sections.filter((s) => s.section_type !== 'timeline'),
    [sections],
  );

  return (
    <Column bindToDocument label={intl.formatMessage(messages.title)}>
      <ColumnBackButton />

      <div className='scrollable sectioned-profile'>
        {account && (
          <div
            className={`sectioned-profile__header-wrap${isOwner ? ' sectioned-profile__header-wrap--owner' : ''}`}
          >
            <AccountHeader accountId={account.id} hideTabs />
          </div>
        )}

        <div className='sectioned-profile__body'>
          {error && (
            <p className='sectioned-profile__error'>
              <FormattedMessage id='sectioned_profile.error' defaultMessage='Could not load profile.' />
              {' '}
              {error}
            </p>
          )}

          {!error && !account && (
            <p className='sectioned-profile__loading'>
              <FormattedMessage id='sectioned_profile.loading' defaultMessage='Loading…' />
            </p>
          )}

          {account && (
            <>
              <div className='sectioned-profile__tabs' role='tablist'>
                <TabButton tab='me' activeTab={activeTab} onSelect={setTab} icon='◐'>
                  <FormattedMessage id='sectioned_profile.tab.me' defaultMessage='Me' />
                </TabButton>
                <TabButton tab='work' activeTab={activeTab} onSelect={setTab} icon='▤'>
                  <FormattedMessage id='sectioned_profile.tab.work' defaultMessage='My Work' />
                </TabButton>
                <TabButton tab='timeline' activeTab={activeTab} onSelect={setTab} icon='≡'>
                  <FormattedMessage id='sectioned_profile.tab.timeline' defaultMessage='Timeline' />
                </TabButton>
                {!isOwner && (
                  <TabButton tab='friendship' activeTab={activeTab} onSelect={setTab} icon='♥'>
                    <FormattedMessage id='sectioned_profile.tab.friendship' defaultMessage='Friendship' />
                  </TabButton>
                )}
              </div>

              <section
                className='sectioned-profile__panel'
                role='tabpanel'
                hidden={activeTab !== 'me'}
              >
                <MePanel isOwner={isOwner} />
              </section>

              <section
                className='sectioned-profile__panel'
                role='tabpanel'
                hidden={activeTab !== 'work'}
              >
                <WorkPanel sections={workSections} isOwner={isOwner} />
              </section>

              <section
                className='sectioned-profile__panel'
                role='tabpanel'
                hidden={activeTab !== 'timeline'}
              >
                <TimelinePanel
                  section={timelineSection}
                  onLoadMore={noopLoadMore}
                />
              </section>

              {!isOwner && (
                <section
                  className='sectioned-profile__panel'
                  role='tabpanel'
                  hidden={activeTab !== 'friendship'}
                >
                  <FriendshipPanel />
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </Column>
  );
};

const TabButton: React.FC<{
  tab: TabKey;
  activeTab: TabKey;
  onSelect: (tab: TabKey) => void;
  icon?: string;
  children: React.ReactNode;
}> = ({ tab, activeTab, onSelect, icon, children }) => {
  const handleClick = useCallback(() => {
    onSelect(tab);
  }, [onSelect, tab]);

  return (
    <button
      type='button'
      role='tab'
      aria-selected={activeTab === tab}
      className={`sectioned-profile__tab${activeTab === tab ? ' sectioned-profile__tab--active' : ''}`}
      onClick={handleClick}
    >
      {icon && (
        <span className='sectioned-profile__tab-icon' aria-hidden>
          {icon}
        </span>
      )}
      {children}
    </button>
  );
};

// Each Me card is heading + one-line description of what the card is
// FOR. No dead-end copy. When identity fields backend ships, real
// content replaces the description; the descriptions stay as the
// aria-hint / empty state.
interface MeCardCopy {
  headingId: string;
  headingDefault: string;
  descId: string;
  descDefault: string;
  note?: boolean;  // uses --note modifier
}

const ME_COL_1: MeCardCopy[] = [
  { headingId: 'sectioned_profile.me.about', headingDefault: 'About me',
    descId: 'sectioned_profile.me.about_desc', descDefault: 'Tell people who you are.' },
  { headingId: 'sectioned_profile.me.interests', headingDefault: 'Interests',
    descId: 'sectioned_profile.me.interests_desc', descDefault: 'What you would talk about for an hour.' },
  { headingId: 'sectioned_profile.me.exploring', headingDefault: 'Currently exploring',
    descId: 'sectioned_profile.me.exploring_desc', descDefault: 'New questions, tools, or practices you are leaning into.' },
];

const ME_COL_2: MeCardCopy[] = [
  { headingId: 'sectioned_profile.me.at_a_glance', headingDefault: 'At a glance',
    descId: 'sectioned_profile.me.at_a_glance_desc', descDefault: 'A quick summary of your presence across Kronk.' },
  { headingId: 'sectioned_profile.me.highlights', headingDefault: 'Recent highlights',
    descId: 'sectioned_profile.me.highlights_desc', descDefault: 'Pinned or featured posts, up to three.' },
  { headingId: 'sectioned_profile.me.personality', headingDefault: 'Personality snapshot',
    descId: 'sectioned_profile.me.personality_desc', descDefault: 'A few words that sound like you.' },
  { headingId: 'sectioned_profile.me.drive', headingDefault: 'What drives me',
    descId: 'sectioned_profile.me.drive_desc', descDefault: 'One short line about what pulls you forward.' },
  { headingId: 'sectioned_profile.me.rotation', headingDefault: 'In rotation',
    descId: 'sectioned_profile.me.rotation_desc', descDefault: 'What you are reading, listening to, watching.' },
];

const ME_COL_3: MeCardCopy[] = [
  { headingId: 'sectioned_profile.me.moments', headingDefault: 'Life in moments',
    descId: 'sectioned_profile.me.moments_desc', descDefault: 'Nine photos. No captions needed.' },
  { headingId: 'sectioned_profile.me.values', headingDefault: 'Values',
    descId: 'sectioned_profile.me.values_desc', descDefault: 'Five words. Not more.' },
  { headingId: 'sectioned_profile.me.note', headingDefault: 'A note',
    descId: 'sectioned_profile.me.note_desc', descDefault: 'Whatever you want to say to whoever visits.',
    note: true },
];

interface OpenToCopy {
  icon: string;
  titleId: string;
  titleDefault: string;
  subId: string;
  subDefault: string;
}

const OPEN_TO: OpenToCopy[] = [
  { icon: '◌', titleId: 'sectioned_profile.me.open_to.conversations',
    titleDefault: 'Meaningful conversations',
    subId: 'sectioned_profile.me.open_to.conversations_desc',
    subDefault: 'Slow ones welcome.' },
  { icon: '❋', titleId: 'sectioned_profile.me.open_to.collabs',
    titleDefault: 'Creative collaborations',
    subId: 'sectioned_profile.me.open_to.collabs_desc',
    subDefault: 'Bring what you make, meet others who make.' },
  { icon: '◈', titleId: 'sectioned_profile.me.open_to.governance',
    titleDefault: 'Governance work',
    subId: 'sectioned_profile.me.open_to.governance_desc',
    subDefault: 'Proposals, Kommons, quiet organising.' },
  { icon: '♥', titleId: 'sectioned_profile.me.open_to.vouching',
    titleDefault: 'Vouching',
    subId: 'sectioned_profile.me.open_to.vouching_desc',
    subDefault: 'A web of trust, one person at a time.' },
];

const MeCard: React.FC<{ card: MeCardCopy }> = ({ card }) => (
  <div className={`sectioned-profile__card${card.note ? ' sectioned-profile__card--note' : ''}`}>
    <h3>
      <FormattedMessage id={card.headingId} defaultMessage={card.headingDefault} />
    </h3>
    <p className='sectioned-profile__card-desc'>
      <FormattedMessage id={card.descId} defaultMessage={card.descDefault} />
    </p>
  </div>
);

const MePanel: React.FC<{ isOwner: boolean }> = () => (
  <>
    <div className='sectioned-profile__me-grid'>
      <div className='sectioned-profile__me-col'>
        {ME_COL_1.map((c) => <MeCard key={c.headingId} card={c} />)}
      </div>
      <div className='sectioned-profile__me-col'>
        {ME_COL_2.map((c) => <MeCard key={c.headingId} card={c} />)}
      </div>
      <div className='sectioned-profile__me-col'>
        {ME_COL_3.map((c) => <MeCard key={c.headingId} card={c} />)}
      </div>
    </div>

    <div className='sectioned-profile__open-to'>
      {OPEN_TO.map((o) => (
        <div key={o.titleId} className='sectioned-profile__open-to-item'>
          <span className='sectioned-profile__open-to-icon' aria-hidden>{o.icon}</span>
          <div>
            <b>
              <FormattedMessage id={o.titleId} defaultMessage={o.titleDefault} />
            </b>
            <span className='sectioned-profile__muted'>
              <FormattedMessage id={o.subId} defaultMessage={o.subDefault} />
            </span>
          </div>
        </div>
      ))}
    </div>

    <p className='sectioned-profile__provisional'>
      <FormattedMessage
        id='sectioned_profile.me.provisional'
        defaultMessage='Identity content wires up when the profile settings surface ships.'
      />
    </p>
  </>
);

const WorkPanel: React.FC<{
  sections: SectionWithStatuses[];
  isOwner: boolean;
}> = ({ sections, isOwner }) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const openSection = useMemo(
    () => sections.find((s) => s.id === openId) ?? null,
    [sections, openId],
  );

  const handleClose = useCallback(() => {
    setOpenId(null);
  }, []);

  useEffect(() => {
    if (!openId) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenId(null);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [openId]);

  return (
    <>
      <div className='sectioned-profile__work-head'>
        <div>
          <h3>
            <FormattedMessage id='sectioned_profile.work.title' defaultMessage='Collected work' />
          </h3>
          <p>
            <FormattedMessage
              id='sectioned_profile.work.subtitle'
              defaultMessage='Rooms you can walk into — sections from korners you post to and kategories you use.'
            />
          </p>
        </div>
        {isOwner && (
          <a
            className='sectioned-profile__work-new'
            href='/settings/profile_sections'
          >
            <FormattedMessage id='sectioned_profile.work.new_card' defaultMessage='＋ New card' />
          </a>
        )}
      </div>

      <div className='sectioned-profile__work-grid'>
        {sections.length === 0 ? (
          <WorkEmptyState isOwner={isOwner} />
        ) : (
          sections.map((section) => (
            <WorkCard key={section.id} section={section} onOpen={setOpenId} />
          ))
        )}
      </div>

      <WorkDrawer section={openSection} onClose={handleClose} />
    </>
  );
};

const WorkCard: React.FC<{
  section: SectionWithStatuses;
  onOpen: (id: string) => void;
}> = ({ section, onOpen }) => {
  const handleClick = useCallback(() => {
    onOpen(section.id);
  }, [onOpen, section.id]);

  return (
    <button
      type='button'
      className='sectioned-profile__work-card'
      onClick={handleClick}
    >
      <span className='sectioned-profile__work-card-open' aria-hidden>
        ＋ open
      </span>
      <div className='sectioned-profile__work-card-preview' />
      <div className='sectioned-profile__work-card-title'>
        {section.title ?? section.section_type}
      </div>
      <div className='sectioned-profile__work-card-sub'>
        <span>{section.statusIds.size}</span>
        <span>·</span>
        <span>{section.section_type}</span>
      </div>
    </button>
  );
};

const WorkDrawer: React.FC<{
  section: SectionWithStatuses | null;
  onClose: () => void;
}> = ({ section, onClose }) => {
  const open = section !== null;
  return (
    <>
      <div
        className={`sectioned-profile__scrim${open ? ' sectioned-profile__scrim--on' : ''}`}
        onClick={onClose}
        role='presentation'
      />
      <aside
        className={`sectioned-profile__drawer${open ? ' sectioned-profile__drawer--on' : ''}`}
        aria-hidden={!open}
        aria-labelledby='sectioned-profile-drawer-title'
      >
        <button
          type='button'
          className='sectioned-profile__drawer-close'
          onClick={onClose}
          aria-label='Close'
        >
          ✕
        </button>
        {section && (
          <>
            <div
              className='sectioned-profile__drawer-title'
              id='sectioned-profile-drawer-title'
            >
              <span className='sectioned-profile__drawer-dot' aria-hidden />
              <span>{section.title ?? section.section_type}</span>
            </div>
            <div className='sectioned-profile__drawer-sub'>
              <FormattedMessage
                id='sectioned_profile.work.drawer_sub'
                defaultMessage='{count, plural, one {# post} other {# posts}} showcased · {kind}'
                values={{ count: section.statusIds.size, kind: section.section_type }}
              />
            </div>
            {section.statusIds.size === 0 ? (
              <p className='sectioned-profile__drawer-empty'>
                <FormattedMessage
                  id='sectioned_profile.work.drawer_empty'
                  defaultMessage='Nothing showcased in this section yet.'
                />
              </p>
            ) : (
              <StatusList
                scrollKey={`sectioned_profile:drawer:${section.id}`}
                statusIds={section.statusIds}
                isLoading={section.loading}
                hasMore={false}
                onLoadMore={noopLoadMore}
                timelineId={`sectioned_profile:drawer:${section.id}`}
              />
            )}
          </>
        )}
      </aside>
    </>
  );
};

// Suggested placeholder categories for the empty-state grid. Naming
// intent from docs/prototypes/kronk-profile-redesign.html — the shape
// of the feature must be legible before any content exists in it.
const PLACEHOLDER_KATEGORIES: string[] = [
  'Poetry', 'Essays', 'Photography', 'Field notes',
  'Reflections', 'Quotes', 'Sketches', 'Letters',
  'Reviews', 'Dialogues', 'Questions', 'Threads',
  'Governance', 'Proposals', 'Projects', 'Recipes',
  'Travel', 'Trades', 'Archive', 'Collections',
];

const WorkEmptyState: React.FC<{ isOwner: boolean }> = ({ isOwner }) => (
  <>
    {isOwner && (
      <a
        className='sectioned-profile__work-placeholder sectioned-profile__work-placeholder--create'
        href='/settings/profile_sections'
      >
        <span className='sectioned-profile__work-placeholder-plus' aria-hidden>＋</span>
        <span className='sectioned-profile__work-placeholder-title'>
          <FormattedMessage
            id='sectioned_profile.work.create_first'
            defaultMessage='Create your first card'
          />
        </span>
        <span className='sectioned-profile__work-placeholder-sub'>
          <FormattedMessage
            id='sectioned_profile.work.create_first_hint'
            defaultMessage='Sort your posts into rooms.'
          />
        </span>
      </a>
    )}
    {PLACEHOLDER_KATEGORIES.map((title) => (
      <div
        key={title}
        className='sectioned-profile__work-placeholder'
        aria-hidden
      >
        <div className='sectioned-profile__work-placeholder-preview' />
        <div className='sectioned-profile__work-placeholder-title'>{title}</div>
        <div className='sectioned-profile__work-placeholder-sub'>0 posts</div>
      </div>
    ))}
  </>
);

const TimelinePanel: React.FC<{
  section: SectionWithStatuses | undefined;
  onLoadMore: () => void;
}> = ({ section, onLoadMore }) => (
  <div className='sectioned-profile__feed'>
    <StatusList
      scrollKey='sectioned_profile:timeline'
      statusIds={section?.statusIds ?? emptyList}
      isLoading={section?.loading ?? true}
      hasMore={false}
      onLoadMore={onLoadMore}
      timelineId='sectioned_profile:timeline'
      emptyMessage={
        <FormattedMessage
          id='sectioned_profile.timeline.empty'
          defaultMessage='No posts yet.'
        />
      }
    />
  </div>
);

const FriendshipPanel: React.FC = () => (
  <div className='sectioned-profile__friendship'>
    <div className='sectioned-profile__fr-hero'>
      <div className='sectioned-profile__fr-pair' aria-hidden>
        <span className='sectioned-profile__fr-pair-avatar' />
        <span className='sectioned-profile__fr-pair-avatar' />
      </div>
      <div className='sectioned-profile__fr-hero-copy'>
        <h3>
          <FormattedMessage
            id='sectioned_profile.friendship.hero_title'
            defaultMessage='How you overlap'
          />
        </h3>
        <p className='sectioned-profile__muted'>
          <FormattedMessage
            id='sectioned_profile.friendship.hero_sub'
            defaultMessage='Connection facts populate once the relationship data is joined in.'
          />
        </p>
      </div>
      <div className='sectioned-profile__fr-tier'>
        <div className='sectioned-profile__fr-tier-val'>—</div>
        <div className='sectioned-profile__fr-tier-lab'>
          <FormattedMessage
            id='sectioned_profile.friendship.tier'
            defaultMessage='vouch tier'
          />
        </div>
      </div>
    </div>

    <div className='sectioned-profile__fr-two'>
      <div className='sectioned-profile__card'>
        <h3>
          <FormattedMessage
            id='sectioned_profile.friendship.how_connected'
            defaultMessage='How you’re connected'
          />
        </h3>
        <div className='sectioned-profile__kv'>
          <b>
            <FormattedMessage
              id='sectioned_profile.friendship.mutual_crews'
              defaultMessage='Mutual crews'
            />
          </b>
          <span className='sectioned-profile__kv-v'>—</span>
        </div>
        <div className='sectioned-profile__kv'>
          <b>
            <FormattedMessage
              id='sectioned_profile.friendship.shared_seeds'
              defaultMessage='Shared seeds'
            />
          </b>
          <span className='sectioned-profile__kv-v'>—</span>
        </div>
        <div className='sectioned-profile__kv'>
          <b>
            <FormattedMessage
              id='sectioned_profile.friendship.mutual_connections'
              defaultMessage='Mutual connections'
            />
          </b>
          <span className='sectioned-profile__kv-v'>—</span>
        </div>
        <div className='sectioned-profile__kv'>
          <b>
            <FormattedMessage
              id='sectioned_profile.friendship.introduced_by'
              defaultMessage='Introduced by'
            />
          </b>
          <span className='sectioned-profile__kv-v'>—</span>
        </div>
      </div>

      <div className='sectioned-profile__card'>
        <h3>
          <FormattedMessage
            id='sectioned_profile.friendship.between'
            defaultMessage='Between you'
          />
        </h3>
        <div className='sectioned-profile__kv'>
          <b>
            <FormattedMessage
              id='sectioned_profile.friendship.conversations'
              defaultMessage='Conversations'
            />
          </b>
          <span className='sectioned-profile__kv-v'>—</span>
        </div>
        <div className='sectioned-profile__kv'>
          <b>
            <FormattedMessage
              id='sectioned_profile.friendship.replies'
              defaultMessage='Replies exchanged'
            />
          </b>
          <span className='sectioned-profile__kv-v'>—</span>
        </div>
        <div className='sectioned-profile__kv'>
          <b>
            <FormattedMessage
              id='sectioned_profile.friendship.boosts'
              defaultMessage='Boosts'
            />
          </b>
          <span className='sectioned-profile__kv-v'>—</span>
        </div>
        <div className='sectioned-profile__kv'>
          <b>
            <FormattedMessage
              id='sectioned_profile.friendship.huddles'
              defaultMessage='Huddles together'
            />
          </b>
          <span className='sectioned-profile__kv-v'>—</span>
        </div>
      </div>
    </div>

    <div className='sectioned-profile__card' style={{ marginTop: '16px' }}>
      <h3>
        <FormattedMessage
          id='sectioned_profile.friendship.overlap'
          defaultMessage='Where you overlap'
        />
      </h3>
      <p className='sectioned-profile__stub'>—</p>
    </div>

    <div className='sectioned-profile__fr-two' style={{ marginTop: '16px' }}>
      <div className='sectioned-profile__card'>
        <h3>
          <FormattedMessage
            id='sectioned_profile.friendship.vouches'
            defaultMessage='Vouches'
          />
        </h3>
        <p className='sectioned-profile__stub'>—</p>
      </div>
      <div className='sectioned-profile__card'>
        <h3>
          <FormattedMessage
            id='sectioned_profile.friendship.history'
            defaultMessage='Your history'
          />
        </h3>
        <p className='sectioned-profile__stub'>—</p>
      </div>
    </div>

    <div className='sectioned-profile__fr-actions'>
      <button type='button' className='sectioned-profile__btn sectioned-profile__btn--primary' disabled>
        <FormattedMessage id='sectioned_profile.friendship.message' defaultMessage='Message' />
      </button>
      <button type='button' className='sectioned-profile__btn' disabled>
        <FormattedMessage
          id='sectioned_profile.friendship.adjust_vouch'
          defaultMessage='Adjust vouch'
        />
      </button>
      <button type='button' className='sectioned-profile__btn' disabled>
        <FormattedMessage
          id='sectioned_profile.friendship.add_to_crew'
          defaultMessage='Add to a crew'
        />
      </button>
    </div>

    <p className='sectioned-profile__provisional'>
      <FormattedMessage
        id='sectioned_profile.friendship.provisional'
        defaultMessage='Vouch tiers are provisional until the Anthemos membrane ships.'
      />
    </p>
  </div>
);

export default SectionedProfile;
