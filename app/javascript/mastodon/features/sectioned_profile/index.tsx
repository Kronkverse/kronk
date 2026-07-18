/* eslint-disable @typescript-eslint/no-unnecessary-condition --
 * `cancelled` mutates in the useEffect cleanup after the async fetch
 * reads it. TS control-flow doesn't track the mutation across the
 * closure so the checks look "always truthy/falsy", but the guards
 * are load-bearing: without them setState fires after unmount. */

import { useEffect, useState, useCallback, useMemo } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { useParams, useLocation, useHistory } from 'react-router-dom';

import { List as ImmutableList } from 'immutable';

import { isAxiosError } from 'axios';

import {
  importFetchedStatuses,
  importFetchedAccount,
} from 'mastodon/actions/importer';
import { apiRequestGet } from 'mastodon/api';
import type { ApiProfileSectionJSON } from 'mastodon/api/profile_sections';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import type { ApiStatusJSON } from 'mastodon/api_types/statuses';
import { Column } from 'mastodon/components/column';
import { ColumnBackButton } from 'mastodon/components/column_back_button';
import StatusList from 'mastodon/components/status_list';
import { me } from 'mastodon/initial_state';
import { useAppDispatch } from 'mastodon/store';

import { KProfileHeader } from './kprofile_header';

const messages = defineMessages({
  title: { id: 'sectioned_profile.title', defaultMessage: 'Profile' },

  // Me panel card copy — heading + description for each empty state.
  aboutTitle: { id: 'sectioned_profile.me.about', defaultMessage: 'About me' },
  aboutDesc: {
    id: 'sectioned_profile.me.about_desc',
    defaultMessage: 'Tell people who you are.',
  },
  interestsTitle: {
    id: 'sectioned_profile.me.interests',
    defaultMessage: 'Interests',
  },
  interestsDesc: {
    id: 'sectioned_profile.me.interests_desc',
    defaultMessage: 'What you would talk about for an hour.',
  },
  exploringTitle: {
    id: 'sectioned_profile.me.exploring',
    defaultMessage: 'Currently exploring',
  },
  exploringDesc: {
    id: 'sectioned_profile.me.exploring_desc',
    defaultMessage: 'New questions, tools, or practices you are leaning into.',
  },
  atGlanceTitle: {
    id: 'sectioned_profile.me.at_a_glance',
    defaultMessage: 'At a glance',
  },
  atGlanceDesc: {
    id: 'sectioned_profile.me.at_a_glance_desc',
    defaultMessage: 'A quick summary of your presence across Kronk.',
  },
  highlightsTitle: {
    id: 'sectioned_profile.me.highlights',
    defaultMessage: 'Recent highlights',
  },
  highlightsDesc: {
    id: 'sectioned_profile.me.highlights_desc',
    defaultMessage: 'Pinned or featured posts, up to three.',
  },
  personalityTitle: {
    id: 'sectioned_profile.me.personality',
    defaultMessage: 'Personality snapshot',
  },
  personalityDesc: {
    id: 'sectioned_profile.me.personality_desc',
    defaultMessage: 'A few words that sound like you.',
  },
  driveTitle: {
    id: 'sectioned_profile.me.drive',
    defaultMessage: 'What drives me',
  },
  driveDesc: {
    id: 'sectioned_profile.me.drive_desc',
    defaultMessage: 'One short line about what pulls you forward.',
  },
  rotationTitle: {
    id: 'sectioned_profile.me.rotation',
    defaultMessage: 'In rotation',
  },
  rotationDesc: {
    id: 'sectioned_profile.me.rotation_desc',
    defaultMessage: 'What you are reading, listening to, watching.',
  },
  momentsTitle: {
    id: 'sectioned_profile.me.moments',
    defaultMessage: 'Life in moments',
  },
  momentsDesc: {
    id: 'sectioned_profile.me.moments_desc',
    defaultMessage: 'Nine photos. No captions needed.',
  },
  valuesTitle: { id: 'sectioned_profile.me.values', defaultMessage: 'Values' },
  valuesDesc: {
    id: 'sectioned_profile.me.values_desc',
    defaultMessage: 'Five words. Not more.',
  },
  noteTitle: { id: 'sectioned_profile.me.note', defaultMessage: 'A note' },
  noteDesc: {
    id: 'sectioned_profile.me.note_desc',
    defaultMessage: 'Whatever you want to say to whoever visits.',
  },

  // Open-to strip
  openConversationsTitle: {
    id: 'sectioned_profile.me.open_to.conversations',
    defaultMessage: 'Meaningful conversations',
  },
  openConversationsDesc: {
    id: 'sectioned_profile.me.open_to.conversations_desc',
    defaultMessage: 'Slow ones welcome.',
  },
  openCollabsTitle: {
    id: 'sectioned_profile.me.open_to.collabs',
    defaultMessage: 'Creative collaborations',
  },
  openCollabsDesc: {
    id: 'sectioned_profile.me.open_to.collabs_desc',
    defaultMessage: 'Bring what you make, meet others who make.',
  },
  openGovernanceTitle: {
    id: 'sectioned_profile.me.open_to.governance',
    defaultMessage: 'Governance work',
  },
  openGovernanceDesc: {
    id: 'sectioned_profile.me.open_to.governance_desc',
    defaultMessage: 'Proposals, Kommons, quiet organising.',
  },
  openVouchingTitle: {
    id: 'sectioned_profile.me.open_to.vouching',
    defaultMessage: 'Vouching',
  },
  openVouchingDesc: {
    id: 'sectioned_profile.me.open_to.vouching_desc',
    defaultMessage: 'A web of trust, one person at a time.',
  },

  // Per-card actions on empty state. Names the thing that happens.
  aboutAction: {
    id: 'sectioned_profile.me.about_action',
    defaultMessage: 'Add a bio',
  },
  interestsAction: {
    id: 'sectioned_profile.me.interests_action',
    defaultMessage: 'Add interests',
  },
  exploringAction: {
    id: 'sectioned_profile.me.exploring_action',
    defaultMessage: 'Add a spark',
  },
  atGlanceAction: {
    id: 'sectioned_profile.me.at_a_glance_action',
    defaultMessage: 'Set up your summary',
  },
  atGlanceTilePosts: {
    id: 'sectioned_profile.me.at_a_glance.posts',
    defaultMessage: 'Posts',
  },
  atGlanceTileFollowing: {
    id: 'sectioned_profile.me.at_a_glance.following',
    defaultMessage: 'Following',
  },
  atGlanceTileFollowers: {
    id: 'sectioned_profile.me.at_a_glance.followers',
    defaultMessage: 'Followers',
  },
  atGlanceTileSince: {
    id: 'sectioned_profile.me.at_a_glance.since',
    defaultMessage: 'Since',
  },
  highlightsAction: {
    id: 'sectioned_profile.me.highlights_action',
    defaultMessage: 'Pin a highlight',
  },
  personalityAction: {
    id: 'sectioned_profile.me.personality_action',
    defaultMessage: 'Add a few words',
  },
  driveAction: {
    id: 'sectioned_profile.me.drive_action',
    defaultMessage: 'Write your line',
  },
  rotationAction: {
    id: 'sectioned_profile.me.rotation_action',
    defaultMessage: 'Add what you are on',
  },
  momentsAction: {
    id: 'sectioned_profile.me.moments_action',
    defaultMessage: 'Add photos',
  },
  valuesAction: {
    id: 'sectioned_profile.me.values_action',
    defaultMessage: 'Add values',
  },
  noteAction: {
    id: 'sectioned_profile.me.note_action',
    defaultMessage: 'Write a note',
  },
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
  const [cards, setCards] = useState<ProfileCardJSON[]>([]);
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

    // Reset per-profile state up front. This component is reused across
    // `/@:acct` routes (React doesn't remount it on navigation), so without
    // this a stale error or the previous profile's content persists — e.g.
    // after landing on any acct that 404s (common on shadow's partial DB),
    // the not_found banner would stick onto every subsequent profile.
    setError(null);
    setAccount(null);
    setCards([]);
    setSections([]);

    let cancelled = false;
    void (async () => {
      // Step 1: account lookup. If this fails, the panel can't render at
      // all — surface the error and stop.
      let accountRes: ApiAccountJSON;
      try {
        accountRes = await apiRequestGet<ApiAccountJSON>('v1/accounts/lookup', {
          acct,
        });
      } catch (e) {
        // A 404 means the acct doesn't resolve here (removed, or a remote
        // account this server hasn't seen) — show a calm "not on Kronk"
        // note, not the raw axios string. Anything else is a load failure.
        if (!cancelled) {
          setError(
            isAxiosError(e) && e.response?.status === 404
              ? 'not_found'
              : 'load_failed',
          );
        }
        return;
      }
      if (cancelled) return;

      dispatch(importFetchedAccount(accountRes));
      setAccount(accountRes);

      // Step 1b: profile cards (the Me tab). The endpoint filters
      // per-viewer, so whatever comes back is renderable as-is. A 404
      // (composer flag off) or any failure just leaves the Me tab on its
      // owner empty-states.
      try {
        const cardList = await apiRequestGet<ProfileCardJSON[]>(
          `v1/accounts/${accountRes.id}/profile/cards`,
        );
        if (!cancelled) setCards(cardList);
      } catch {
        if (!cancelled) {
          console.warn(
            'SectionedProfile: cards fetch failed; Me tab shows empty states',
          );
        }
      }
      if (cancelled) return;

      // Step 2: sections list. Independent of statuses. A failure here
      // means the user sees the tabs + placeholder grids instead of an
      // empty panel and a scary red error.
      let sectionList: ApiProfileSectionJSON[] = [];
      try {
        sectionList = await apiRequestGet<ApiProfileSectionJSON[]>(
          `v1/accounts/${accountRes.id}/profile/sections`,
        );
      } catch {
        // Log but don't setError — the rest of the surface can render.
        if (!cancelled) {
          console.warn(
            'SectionedProfile: sections fetch failed; rendering empty state',
          );
        }
      }
      if (cancelled) return;

      const enriched: SectionWithStatuses[] = sectionList.map((s) => ({
        ...s,
        statusIds: emptyList,
        loading: true,
      }));
      setSections(enriched);

      // Step 3: statuses per section. Each fetch is independent; one
      // failure doesn't fail the others. `loading: false` is set either
      // way so the UI stops showing skeletons.
      await Promise.all(
        sectionList.map(async (s) => {
          try {
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
          } catch {
            if (cancelled) return;
            setSections((prev) =>
              prev.map((row) =>
                row.id === s.id ? { ...row, loading: false } : row,
              ),
            );
          }
        }),
      );
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
        {account && <KProfileHeader account={account} />}

        <div className='sectioned-profile__body'>
          {error === 'not_found' && (
            <p className='sectioned-profile__error'>
              <FormattedMessage
                id='sectioned_profile.not_found'
                defaultMessage="This profile isn't on Kronk — it may have been removed, or it lives on another server."
              />
            </p>
          )}

          {error === 'load_failed' && (
            <p className='sectioned-profile__error'>
              <FormattedMessage
                id='sectioned_profile.error'
                defaultMessage='Could not load this profile. Please try again in a moment.'
              />
            </p>
          )}

          {!error && !account && (
            <p className='sectioned-profile__loading'>
              <FormattedMessage
                id='sectioned_profile.loading'
                defaultMessage='Loading…'
              />
            </p>
          )}

          {account && (
            <>
              <div className='sectioned-profile__tabs' role='tablist'>
                <TabButton
                  tab='me'
                  activeTab={activeTab}
                  onSelect={setTab}
                  icon='◐'
                >
                  <FormattedMessage
                    id='sectioned_profile.tab.me'
                    defaultMessage='Me'
                  />
                </TabButton>
                <TabButton
                  tab='work'
                  activeTab={activeTab}
                  onSelect={setTab}
                  icon='▤'
                >
                  <FormattedMessage
                    id='sectioned_profile.tab.work'
                    defaultMessage='My Work'
                  />
                </TabButton>
                <TabButton
                  tab='timeline'
                  activeTab={activeTab}
                  onSelect={setTab}
                  icon='≡'
                >
                  <FormattedMessage
                    id='sectioned_profile.tab.timeline'
                    defaultMessage='Timeline'
                  />
                </TabButton>
                {!isOwner && (
                  <TabButton
                    tab='friendship'
                    activeTab={activeTab}
                    onSelect={setTab}
                    icon='♥'
                  >
                    <FormattedMessage
                      id='sectioned_profile.tab.friendship'
                      defaultMessage='Friendship'
                    />
                  </TabButton>
                )}
              </div>

              <section
                className='sectioned-profile__panel'
                role='tabpanel'
                hidden={activeTab !== 'me'}
              >
                <MePanel isOwner={isOwner} account={account} cards={cards} />
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
//
// Message descriptors are static (defined at module-scope via
// defineMessages above) so react-intl's babel extractor can scan them
// at build time. Do NOT pass dynamic ids/defaults to FormattedMessage
// — the Vite pipeline rejects it. Instead we resolve via
// intl.formatMessage(descriptor) at render time.

interface MessageDescriptor {
  id: string;
  defaultMessage: string;
}

// A composed identity card, as returned by
// GET /api/v1/accounts/:id/profile/cards. The endpoint already filters
// per-viewer (ProfileCard#visible_to?), so only cards this viewer is
// allowed to see arrive here — no client-side visibility gating needed.
interface ProfileCardJSON {
  id: string;
  card_type: string;
  body: string; // server-sanitised HTML
  visibility: 'everyone' | 'kronk' | 'connections' | 'vouched' | 'only_me';
  position: number;
  visible: boolean;
}

interface MeCardCopy {
  title: MessageDescriptor;
  desc: MessageDescriptor;
  action: MessageDescriptor;
  note?: boolean;
  // The ProfileCard type this slot renders. A slot shows content only when
  // the owner has composed (and made visible) the matching card — content
  // comes from the composer, not from account custom fields.
  cardType: string;
  // Marker for slots that render live content (counts / statuses / media)
  // when the card is present, instead of the composed card body.
  kind?: 'at-a-glance' | 'highlights' | 'moments';
}

// Empty-state actions open the composer, where the owner places and fills
// the card for this slot. These render only on the owner's own profile,
// so the viewed acct is always the owner's — this is always your composer.
const composerHref = (account: ApiAccountJSON): string =>
  `/@${account.acct}/edit`;

// Geometric glyphs — the Kronk icon language (monochrome, purple, NOT
// emoji) — that give each Me card a visual identity in its heading so
// the panel reads as a set of distinct cards rather than a wall of text.
const CARD_GLYPH: Record<string, string> = {
  about: '◐',
  interests: '✦',
  exploring: '❋',
  at_a_glance: '▦',
  highlights: '✧',
  personality: '◍',
  drive: '◈',
  rotation: '↻',
  moments: '▤',
  values: '◆',
  note: '❝',
};

// Card heading with its geometric glyph. Shared by every Me card so the
// glyph + type styling stay identical across text, live, and empty slots.
const CardHeading: React.FC<{
  cardType: string;
  children: React.ReactNode;
}> = ({ cardType, children }) => (
  <h3 className='sectioned-profile__card-heading'>
    {CARD_GLYPH[cardType] && (
      <span className='sectioned-profile__card-glyph' aria-hidden>
        {CARD_GLYPH[cardType]}
      </span>
    )}
    <span>{children}</span>
  </h3>
);

// Card types whose composed body is a short separated list ("A · B · C")
// rather than prose — rendered as scannable chips instead of a sentence.
const CHIP_TYPES = new Set([
  'interests',
  'values',
  'personality',
  'drive',
  'rotation',
]);

// Split a composed card body (server-sanitised HTML) into chip labels on
// the middot / bullet / pipe / newline separators the composer uses.
// Tags are stripped, so chips are plain text (no dangerouslySetInnerHTML).
const bodyToChips = (html: string): string[] =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .split(/\s*[·•|\n]+\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

// Columns lead with a VISUAL card so the profile opens on imagery /
// live content, not prose: the top row is At a glance (stat tiles) ·
// Recent highlights (pinned media) · Life in moments (photo grid). The
// text identity cards sit beneath each visual lead.
const ME_COL_1: MeCardCopy[] = [
  {
    title: messages.atGlanceTitle,
    desc: messages.atGlanceDesc,
    action: messages.atGlanceAction,
    cardType: 'at_a_glance',
    kind: 'at-a-glance',
  },
  {
    title: messages.aboutTitle,
    desc: messages.aboutDesc,
    action: messages.aboutAction,
    cardType: 'about',
  },
  {
    title: messages.interestsTitle,
    desc: messages.interestsDesc,
    action: messages.interestsAction,
    cardType: 'interests',
  },
  {
    title: messages.exploringTitle,
    desc: messages.exploringDesc,
    action: messages.exploringAction,
    cardType: 'exploring',
  },
];

const ME_COL_2: MeCardCopy[] = [
  {
    title: messages.highlightsTitle,
    desc: messages.highlightsDesc,
    action: messages.highlightsAction,
    cardType: 'highlights',
    kind: 'highlights',
  },
  {
    title: messages.personalityTitle,
    desc: messages.personalityDesc,
    action: messages.personalityAction,
    cardType: 'personality',
  },
  {
    title: messages.driveTitle,
    desc: messages.driveDesc,
    action: messages.driveAction,
    cardType: 'drive',
  },
  {
    title: messages.rotationTitle,
    desc: messages.rotationDesc,
    action: messages.rotationAction,
    cardType: 'rotation',
  },
];

const ME_COL_3: MeCardCopy[] = [
  {
    title: messages.momentsTitle,
    desc: messages.momentsDesc,
    action: messages.momentsAction,
    cardType: 'moments',
    kind: 'moments',
  },
  {
    title: messages.valuesTitle,
    desc: messages.valuesDesc,
    action: messages.valuesAction,
    cardType: 'values',
  },
  {
    title: messages.noteTitle,
    desc: messages.noteDesc,
    action: messages.noteAction,
    note: true,
    cardType: 'note',
  },
];

interface OpenToCopy {
  icon: string;
  title: MessageDescriptor;
  sub: MessageDescriptor;
}

const OPEN_TO: OpenToCopy[] = [
  {
    icon: '◌',
    title: messages.openConversationsTitle,
    sub: messages.openConversationsDesc,
  },
  {
    icon: '❋',
    title: messages.openCollabsTitle,
    sub: messages.openCollabsDesc,
  },
  {
    icon: '◈',
    title: messages.openGovernanceTitle,
    sub: messages.openGovernanceDesc,
  },
  {
    icon: '♥',
    title: messages.openVouchingTitle,
    sub: messages.openVouchingDesc,
  },
];

// Owner-only prompt shown in a Me slot the owner hasn't composed a card
// for yet. Visitors never see empty slots (MeCard returns null for them).
const EmptyMeCard: React.FC<{
  card: MeCardCopy;
  account: ApiAccountJSON;
}> = ({ card, account }) => {
  const intl = useIntl();
  return (
    <div
      className={`sectioned-profile__card${card.note ? ' sectioned-profile__card--note' : ''}`}
    >
      <CardHeading cardType={card.cardType}>
          {intl.formatMessage(card.title)}
        </CardHeading>
      <p className='sectioned-profile__card-desc'>
        {intl.formatMessage(card.desc)}
      </p>
      <a
        href={composerHref(account)}
        className='sectioned-profile__card-action'
      >
        {intl.formatMessage(card.action)}
      </a>
    </div>
  );
};

const MeCard: React.FC<{
  card: MeCardCopy;
  isOwner: boolean;
  account: ApiAccountJSON;
  composed?: ProfileCardJSON;
}> = ({ card, isOwner, account, composed }) => {
  const intl = useIntl();

  // Live slots (counts / highlights / moments) render their component only
  // when the owner has placed the matching card in the composer.
  if (card.kind === 'at-a-glance') {
    if (composed) return <AtAGlanceCard account={account} />;
    return isOwner ? <EmptyMeCard card={card} account={account} /> : null;
  }
  if (card.kind === 'highlights') {
    if (composed)
      return <HighlightsCard card={card} account={account} isOwner={isOwner} />;
    return isOwner ? <EmptyMeCard card={card} account={account} /> : null;
  }
  if (card.kind === 'moments') {
    if (composed)
      return <MomentsCard card={card} account={account} isOwner={isOwner} />;
    return isOwner ? <EmptyMeCard card={card} account={account} /> : null;
  }

  // Text identity slots render the composed card body (server-sanitised
  // HTML). No composed card → owner sees the prompt, visitor sees nothing.
  if (composed?.body) {
    // List-style cards (interests, values, …) render as scannable chips
    // when the body splits into 2+ segments; otherwise fall back to the
    // sanitised body (prose, or a single item).
    const chips = CHIP_TYPES.has(card.cardType)
      ? bodyToChips(composed.body)
      : [];
    return (
      <div
        className={`sectioned-profile__card${card.note ? ' sectioned-profile__card--note' : ''}`}
      >
        <CardHeading cardType={card.cardType}>
          {intl.formatMessage(card.title)}
        </CardHeading>
        {chips.length >= 2 ? (
          <ul className='sectioned-profile__chips'>
            {chips.map((chip) => (
              <li key={chip} className='sectioned-profile__chip'>
                {chip}
              </li>
            ))}
          </ul>
        ) : (
          <div
            className='sectioned-profile__card-body'
            // composed.body is server-sanitised HTML (may contain <a>).
            dangerouslySetInnerHTML={{ __html: composed.body }}
          />
        )}
      </div>
    );
  }

  return isOwner ? <EmptyMeCard card={card} account={account} /> : null;
};

// Populated "At a glance" — 4 tiles reading real Mastodon account
// counters. No backend change. Shown for both owner and visitor.
const AtAGlanceCard: React.FC<{ account: ApiAccountJSON }> = ({ account }) => {
  const intl = useIntl();
  const joinedYear = new Date(account.created_at).getFullYear();

  return (
    <div className='sectioned-profile__card'>
      <CardHeading cardType='at_a_glance'>
        {intl.formatMessage(messages.atGlanceTitle)}
      </CardHeading>
      <div className='sectioned-profile__tiles'>
        <div className='sectioned-profile__tile'>
          <b>{account.statuses_count}</b>
          <span>{intl.formatMessage(messages.atGlanceTilePosts)}</span>
        </div>
        <div className='sectioned-profile__tile'>
          <b>{account.following_count}</b>
          <span>{intl.formatMessage(messages.atGlanceTileFollowing)}</span>
        </div>
        <div className='sectioned-profile__tile'>
          <b>{account.followers_count}</b>
          <span>{intl.formatMessage(messages.atGlanceTileFollowers)}</span>
        </div>
        <div className='sectioned-profile__tile'>
          <b>{joinedYear}</b>
          <span>{intl.formatMessage(messages.atGlanceTileSince)}</span>
        </div>
      </div>
    </div>
  );
};

// Populated "Recent highlights" — up to 3 pinned statuses, matching
// the prototype's `.highlights / .hl` treatment. Falls back to the
// empty-state MeCard when no pinned statuses exist.
const HighlightsCard: React.FC<{
  card: MeCardCopy;
  account: ApiAccountJSON;
  isOwner: boolean;
}> = ({ card, account, isOwner }) => {
  const intl = useIntl();
  const [pinned, setPinned] = useState<ApiStatusJSON[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void apiRequestGet<ApiStatusJSON[]>(`v1/accounts/${account.id}/statuses`, {
      pinned: true,
      limit: 3,
    })
      .then((rows) => {
        if (!cancelled) setPinned(rows);
      })
      .catch(() => {
        if (!cancelled) setPinned([]);
      });
    return () => {
      cancelled = true;
    };
  }, [account.id]);

  // Loading — show heading with no content to avoid empty→filled flicker.
  if (pinned === null) {
    return (
      <div className='sectioned-profile__card'>
        <CardHeading cardType={card.cardType}>
          {intl.formatMessage(card.title)}
        </CardHeading>
      </div>
    );
  }

  // No pinned statuses — full empty-state template with action.
  if (pinned.length === 0) {
    return (
      <div className='sectioned-profile__card'>
        <CardHeading cardType={card.cardType}>
          {intl.formatMessage(card.title)}
        </CardHeading>
        <p className='sectioned-profile__card-desc'>
          {intl.formatMessage(card.desc)}
        </p>
        {isOwner && (
          <a
            href={composerHref(account)}
            className='sectioned-profile__card-action'
          >
            {intl.formatMessage(card.action)}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className='sectioned-profile__card'>
      <CardHeading cardType={card.cardType}>
          {intl.formatMessage(card.title)}
        </CardHeading>
      <div className='sectioned-profile__highlights'>
        {pinned.map((status) => (
          <HighlightTile key={status.id} status={status} />
        ))}
      </div>
    </div>
  );
};

const HighlightTile: React.FC<{ status: ApiStatusJSON }> = ({ status }) => {
  const media = status.media_attachments[0];
  const excerpt =
    status.spoiler_text.length > 0
      ? status.spoiler_text
      : (status.content ?? '')
          .replace(/<[^>]+>/g, '')
          .trim()
          .slice(0, 60);
  // Mastodon's JSON API uses `favourites_count` (British spelling);
  // the local TS type uses `favorites_count`. Handle both to be safe.
  const raw = status as unknown as {
    favourites_count?: number;
    favorites_count?: number;
  };
  const favCount = raw.favourites_count ?? raw.favorites_count ?? 0;

  return (
    <a href={status.url} className='sectioned-profile__highlight'>
      <div
        className='sectioned-profile__highlight-thumb'
        style={
          media ? { backgroundImage: `url(${media.preview_url})` } : undefined
        }
      />
      <div className='sectioned-profile__highlight-cap'>
        <b>{excerpt.length > 0 ? excerpt : '…'}</b>
        <span>♥ {favCount}</span>
      </div>
    </a>
  );
};

// Populated "Life in moments" — up to 9 media thumbnails from the
// account's media-only timeline. Matches the prototype's `.gallery / .g`.
const MomentsCard: React.FC<{
  card: MeCardCopy;
  account: ApiAccountJSON;
  isOwner: boolean;
}> = ({ card, account, isOwner }) => {
  const intl = useIntl();
  const [moments, setMoments] = useState<ApiStatusJSON[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void apiRequestGet<ApiStatusJSON[]>(`v1/accounts/${account.id}/statuses`, {
      only_media: true,
      limit: 9,
      exclude_reblogs: true,
    })
      .then((rows) => {
        if (!cancelled) setMoments(rows);
      })
      .catch(() => {
        if (!cancelled) setMoments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [account.id]);

  if (moments === null) {
    return (
      <div className='sectioned-profile__card'>
        <CardHeading cardType={card.cardType}>
          {intl.formatMessage(card.title)}
        </CardHeading>
      </div>
    );
  }

  // Flatten all media across statuses into a single thumb list (up to 9).
  const thumbs = moments
    .flatMap((s) =>
      s.media_attachments.map((m) => ({
        mediaId: m.id,
        statusUrl: s.url,
        previewUrl: m.preview_url,
      })),
    )
    .slice(0, 9);

  if (thumbs.length === 0) {
    return (
      <div className='sectioned-profile__card'>
        <CardHeading cardType={card.cardType}>
          {intl.formatMessage(card.title)}
        </CardHeading>
        <p className='sectioned-profile__card-desc'>
          {intl.formatMessage(card.desc)}
        </p>
        {isOwner && (
          <a
            href={composerHref(account)}
            className='sectioned-profile__card-action'
          >
            {intl.formatMessage(card.action)}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className='sectioned-profile__card'>
      <CardHeading cardType={card.cardType}>
          {intl.formatMessage(card.title)}
        </CardHeading>
      <div className='sectioned-profile__gallery'>
        {thumbs.map((t) => (
          <a
            key={t.mediaId}
            href={t.statusUrl}
            className='sectioned-profile__gallery-tile'
            style={{ backgroundImage: `url(${t.previewUrl})` }}
            aria-label={intl.formatMessage(card.title)}
          />
        ))}
      </div>
    </div>
  );
};

const MePanel: React.FC<{
  isOwner: boolean;
  account: ApiAccountJSON;
  cards: ProfileCardJSON[];
}> = ({ isOwner, account, cards }) => {
  const intl = useIntl();
  const cardByType = useMemo(() => {
    const m = new Map<string, ProfileCardJSON>();
    for (const c of cards) m.set(c.card_type, c);
    return m;
  }, [cards]);
  return (
    <>
      <div className='sectioned-profile__me-grid'>
        <div className='sectioned-profile__me-col'>
          {ME_COL_1.map((c) => (
            <MeCard
              key={c.title.id}
              card={c}
              isOwner={isOwner}
              account={account}
              composed={cardByType.get(c.cardType)}
            />
          ))}
        </div>
        <div className='sectioned-profile__me-col'>
          {ME_COL_2.map((c) => (
            <MeCard
              key={c.title.id}
              card={c}
              isOwner={isOwner}
              account={account}
              composed={cardByType.get(c.cardType)}
            />
          ))}
        </div>
        <div className='sectioned-profile__me-col'>
          {ME_COL_3.map((c) => (
            <MeCard
              key={c.title.id}
              card={c}
              isOwner={isOwner}
              account={account}
              composed={cardByType.get(c.cardType)}
            />
          ))}
        </div>
      </div>

      <div className='sectioned-profile__open-to'>
        {OPEN_TO.map((o) => (
          <div key={o.title.id} className='sectioned-profile__open-to-item'>
            <span className='sectioned-profile__open-to-icon' aria-hidden>
              {o.icon}
            </span>
            <div>
              <b>{intl.formatMessage(o.title)}</b>
              <span className='sectioned-profile__muted'>
                {intl.formatMessage(o.sub)}
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
};

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
            <FormattedMessage
              id='sectioned_profile.work.title'
              defaultMessage='Collected work'
            />
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
            <FormattedMessage
              id='sectioned_profile.work.new_card'
              defaultMessage='＋ New card'
            />
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
                values={{
                  count: section.statusIds.size,
                  kind: section.section_type,
                }}
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
  'Poetry',
  'Essays',
  'Photography',
  'Field notes',
  'Reflections',
  'Quotes',
  'Sketches',
  'Letters',
  'Reviews',
  'Dialogues',
  'Questions',
  'Threads',
  'Governance',
  'Proposals',
  'Projects',
  'Recipes',
  'Travel',
  'Trades',
  'Archive',
  'Collections',
];

const WorkEmptyState: React.FC<{ isOwner: boolean }> = ({ isOwner }) => (
  <>
    {isOwner && (
      <a
        className='sectioned-profile__work-placeholder sectioned-profile__work-placeholder--create'
        href='/settings/profile_sections'
      >
        <span className='sectioned-profile__work-placeholder-plus' aria-hidden>
          ＋
        </span>
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
      <button
        type='button'
        className='sectioned-profile__btn sectioned-profile__btn--primary'
        disabled
      >
        <FormattedMessage
          id='sectioned_profile.friendship.message'
          defaultMessage='Message'
        />
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
