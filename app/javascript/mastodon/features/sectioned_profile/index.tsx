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

  const noopLoadMore = useCallback(() => undefined, []);

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
        {account && <AccountHeader accountId={account.id} hideTabs />}

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
                <TabButton tab='me' activeTab={activeTab} onSelect={setTab}>
                  <FormattedMessage id='sectioned_profile.tab.me' defaultMessage='Me' />
                </TabButton>
                <TabButton tab='work' activeTab={activeTab} onSelect={setTab}>
                  <FormattedMessage id='sectioned_profile.tab.work' defaultMessage='My Work' />
                </TabButton>
                <TabButton tab='timeline' activeTab={activeTab} onSelect={setTab}>
                  <FormattedMessage id='sectioned_profile.tab.timeline' defaultMessage='Timeline' />
                </TabButton>
                {!isOwner && (
                  <TabButton tab='friendship' activeTab={activeTab} onSelect={setTab}>
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
  children: React.ReactNode;
}> = ({ tab, activeTab, onSelect, children }) => {
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
      {children}
    </button>
  );
};

const MePanel: React.FC<{ isOwner: boolean }> = ({ isOwner }) => (
  <div className='sectioned-profile__me-grid'>
    <div className='sectioned-profile__me-col'>
      <div className='sectioned-profile__card'>
        <h3>
          <FormattedMessage id='sectioned_profile.me.about' defaultMessage='About' />
        </h3>
        <p className='sectioned-profile__stub'>
          {isOwner ? (
            <FormattedMessage
              id='sectioned_profile.me.stub_owner'
              defaultMessage='Your identity cards will appear here. Configure them in profile settings.'
            />
          ) : (
            <FormattedMessage
              id='sectioned_profile.me.stub_visitor'
              defaultMessage='This person hasn’t set up their profile cards yet.'
            />
          )}
        </p>
      </div>

      <div className='sectioned-profile__card'>
        <h3>
          <FormattedMessage id='sectioned_profile.me.interests' defaultMessage='Interests' />
        </h3>
        <p className='sectioned-profile__stub'>—</p>
      </div>
    </div>

    <div className='sectioned-profile__me-col'>
      <div className='sectioned-profile__card'>
        <h3>
          <FormattedMessage id='sectioned_profile.me.at_a_glance' defaultMessage='At a glance' />
        </h3>
        <p className='sectioned-profile__stub'>—</p>
      </div>

      <div className='sectioned-profile__card'>
        <h3>
          <FormattedMessage id='sectioned_profile.me.drive' defaultMessage='What drives me' />
        </h3>
        <p className='sectioned-profile__stub'>—</p>
      </div>
    </div>

    <div className='sectioned-profile__me-col'>
      <div className='sectioned-profile__card'>
        <h3>
          <FormattedMessage id='sectioned_profile.me.values' defaultMessage='Values' />
        </h3>
        <p className='sectioned-profile__stub'>—</p>
      </div>
    </div>

    <p className='sectioned-profile__provisional' style={{ gridColumn: '1 / -1' }}>
      <FormattedMessage
        id='sectioned_profile.me.provisional'
        defaultMessage='Identity fields are the framework stub — content wires up when profile settings ship.'
      />
    </p>
  </div>
);

const WorkPanel: React.FC<{
  sections: SectionWithStatuses[];
  isOwner: boolean;
}> = ({ sections, isOwner }) => (
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
    </div>

    <div className='sectioned-profile__work-grid'>
      {sections.length === 0 && (
        <p className='sectioned-profile__work-empty'>
          {isOwner ? (
            <FormattedMessage
              id='sectioned_profile.work.empty_owner'
              defaultMessage='No sections yet. Add korner or kategory sections in profile settings.'
            />
          ) : (
            <FormattedMessage
              id='sectioned_profile.work.empty_visitor'
              defaultMessage='Nothing collected yet.'
            />
          )}
        </p>
      )}

      {sections.map((section) => (
        <div key={section.id} className='sectioned-profile__work-card'>
          <div className='sectioned-profile__work-card-preview' />
          <div className='sectioned-profile__work-card-title'>
            {section.title ?? section.section_type}
          </div>
          <div className='sectioned-profile__work-card-sub'>
            <span>{section.statusIds.size}</span>
            <span>·</span>
            <span>{section.section_type}</span>
          </div>
        </div>
      ))}
    </div>
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
    <div className='sectioned-profile__card'>
      <h3>
        <FormattedMessage
          id='sectioned_profile.friendship.title'
          defaultMessage='How you overlap'
        />
      </h3>
      <p className='sectioned-profile__stub'>
        <FormattedMessage
          id='sectioned_profile.friendship.stub'
          defaultMessage='Friendship view is the framework stub — mutual connections, shared crews, and vouches will populate here.'
        />
      </p>
      <p className='sectioned-profile__provisional'>
        <FormattedMessage
          id='sectioned_profile.friendship.provisional'
          defaultMessage='Vouch tiers are provisional until the Anthemos membrane ships.'
        />
      </p>
    </div>
  </div>
);

export default SectionedProfile;
