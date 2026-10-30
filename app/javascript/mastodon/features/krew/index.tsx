import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Link, useHistory, useLocation } from 'react-router-dom';

import { apiGetKrews, apiJoinKrew } from 'mastodon/api/krew';
import type { ApiKrewJSON } from 'mastodon/api/krew';
import type { FtdProject } from 'mastodon/api_types/freethedream';
import { FeedDrum } from 'mastodon/components/feed_drum';
import { KornerPill } from 'mastodon/components/korner_pill';
import { Stage } from 'mastodon/components/stage';
import { ProjectComposer } from 'mastodon/features/freethedream/components/project_composer';
import { projectPath } from 'mastodon/features/freethedream/components/shared';
import { useKonnectReturn } from 'mastodon/hooks/useKonnectReturn';

import { KrewAccessMark } from './krew_access_mark';
import { KrewComposer } from './krew_composer';

// Krews landing (/hub/krew). Two lenses per docs/spaces/krew.md:
//   Yours     — the current account's memberships, ordered by
//               last_activity_at desc.
//   Discover  — listed Krews with the current account's join state.
// Redesigned 2026-07-24 — centered column, real hero, chunky
// segmented control + primary CTA, empty state as a proper card.
// CSS classes moved to the `.krew-page__*` namespace so the
// aesthetic reads coherently with Hub / Kalendar Spiral.

const messages = defineMessages({
  title: { id: 'krew.title', defaultMessage: 'Krews' },
  members: {
    id: 'krew.members_count',
    defaultMessage: '{count, plural, one {# member} other {# members}}',
  },
  loading: { id: 'krew.loading', defaultMessage: 'Loading…' },
  emptyYoursTitle: {
    id: 'krew.empty.yours_title',
    defaultMessage: "You're not in any Krews yet.",
  },
  emptyYoursBody: {
    id: 'krew.empty.yours_body',
    defaultMessage:
      'Gather one to share with a defined group — or switch to Discover to find one to join.',
  },
  emptyDiscoverTitle: {
    id: 'krew.empty.discover_title',
    defaultMessage: 'No Krews to discover just yet.',
  },
  emptyDiscoverBody: {
    id: 'krew.empty.discover_body',
    defaultMessage: 'Be the first — gather one and others can join.',
  },
  join: { id: 'krew.row.join', defaultMessage: 'Join' },
  askToJoin: { id: 'krew.row.ask_to_join', defaultMessage: 'Ask to join' },
  asked: { id: 'krew.row.asked', defaultMessage: 'Asked to join' },
  member: { id: 'krew.row.member', defaultMessage: 'Member' },
  seeWhatsNeeded: {
    id: 'krew.row.see_whats_needed',
    defaultMessage: "See what's needed",
  },
});

type Lens = 'yours' | 'discover';

const initialSquircle = (name: string): string => {
  const first = name.trim().charAt(0);
  return first.length === 0 ? 'K' : first.toUpperCase();
};

const relativeTime = (iso: string | null): string => {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.round(days / 7)}w ago`;
};

// What the Discover row offers beside the Krew. Open Krews join in one tap;
// an `approval` Krew takes a request that any member can accept. A
// requirement-gated Krew is checked on its page, so the row sends you there.
const KrewRowAction: React.FC<{
  krew: ApiKrewJSON;
  onJoin: (krew: ApiKrewJSON) => void;
  busy: boolean;
}> = ({ krew, onJoin, busy }) => {
  const history = useHistory();
  const handleJoin = useCallback(() => {
    onJoin(krew);
  }, [krew, onJoin]);
  const handleSeeNeeded = useCallback(() => {
    history.push(`/hub/krew/${krew.slug}`);
  }, [history, krew.slug]);

  if (krew.viewer_role) {
    return (
      <span className='krew-page__row-state'>
        <FormattedMessage {...messages.member} />
      </span>
    );
  }
  if (krew.viewer_requested) {
    return (
      <span className='krew-page__row-state'>
        <FormattedMessage {...messages.asked} />
      </span>
    );
  }
  if (krew.access === 'requirement_gated') {
    return (
      <KornerPill
        label={<FormattedMessage {...messages.seeWhatsNeeded} />}
        onClick={handleSeeNeeded}
      />
    );
  }
  if (krew.access !== 'open' && krew.access !== 'approval') return null;

  return (
    <KornerPill
      variant='primary'
      label={
        <FormattedMessage
          {...(krew.access === 'open' ? messages.join : messages.askToJoin)}
        />
      }
      onClick={handleJoin}
      disabled={busy}
    />
  );
};

const KrewRow: React.FC<{
  krew: ApiKrewJSON;
  // Set on Discover, where a row can be joined from the list.
  onJoin?: (krew: ApiKrewJSON) => void;
  busy?: boolean;
}> = ({ krew, onJoin, busy = false }) => {
  const intl = useIntl();
  return (
    <li className='krew-page__row'>
      <Link to={`/hub/krew/${krew.slug}`} className='krew-page__row-link'>
        <span
          className='krew-page__row-avatar'
          aria-hidden='true'
          data-initial={initialSquircle(krew.name)}
        >
          {krew.image_url ? (
            <img
              src={krew.image_url}
              alt=''
              className='krew-page__row-avatar-img'
            />
          ) : (
            initialSquircle(krew.name)
          )}
        </span>
        <div className='krew-page__row-body'>
          <div className='krew-page__row-title'>
            <h3 className='krew-page__row-name'>{krew.name}</h3>
            <KrewAccessMark
              access={krew.access}
              className='krew-page__row-marker'
            />
          </div>
          {krew.description && (
            <p className='krew-page__row-desc'>{krew.description}</p>
          )}
          <small className='krew-page__row-meta'>
            {intl.formatMessage(messages.members, {
              count: krew.member_count,
            })}
            {krew.last_activity_at
              ? ` · ${relativeTime(krew.last_activity_at)}`
              : ''}
          </small>
        </div>
      </Link>
      {onJoin && (
        <div className='krew-page__row-action'>
          <KrewRowAction krew={krew} onJoin={onJoin} busy={busy} />
        </div>
      )}
    </li>
  );
};

interface KrewsProps {
  // When true (the `/hub/krew/composer` or legacy `/hub/krew/new`
  // route), the `<KrewComposer>` overlay opens automatically on
  // mount. The Ж floating bubble sends the user there via the
  // manifest's `compose.route`. Same pattern as Albutts +
  // Moments — Krews stays mounted as the composer's background.
  autoOpenComposer?: boolean;
  // `/hub/krew/composer/projekt`: seed a projekt in one of your Krews
  // (docs/spaces/freethedream.md, The Krew), over the Krews page. A Krew
  // page's New projekt and the Konnect picker's open it with
  // `?konnect=<source>`, and Cancel goes back there.
  autoOpenProjekt?: boolean;
}

export const Krews: React.FC<KrewsProps> = ({
  autoOpenComposer,
  autoOpenProjekt,
}) => {
  const intl = useIntl();
  const history = useHistory();
  // The lens is the SpaceNav view — derived from the URL so the shared
  // AutoSpaceViewPicker drives it. `/hub/krew` = Yours (default),
  // `/hub/krew/discover` = Discover. No in-page tab state.
  const location = useLocation();
  const lens: Lens = location.pathname.endsWith('/discover')
    ? 'discover'
    : 'yours';
  // Yours <-> Discover turns the classic Kronk barrel (same FeedDrum the home
  // feed uses for scope changes): the outgoing list swings edge-on as the
  // incoming list swings in. Driven either by the SpaceNav picker (URL change ->
  // lens -> reach prop) or the drum's own horizontal swipe (onScopeChange).
  const handleLensChange = useCallback(
    (key: string) => {
      history.push(key === 'discover' ? '/hub/krew/discover' : '/hub/krew');
    },
    [history],
  );
  const [krews, setKrews] = useState<ApiKrewJSON[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(Boolean(autoOpenComposer));
  // Opening the composer is a prop change, not a mount. Tapping "New album"
  // in the Ж menu while already in the space swaps which <Route> matches, but
  // the component underneath is the same type in the same slot — so React
  // updates it in place and a `useState` initialiser never runs a second
  // time. Seeding the state from the prop worked only when the composer URL
  // was where you arrived, which is why this looked fine from a cold load and
  // did nothing from the menu.
  useEffect(() => {
    if (autoOpenComposer) setComposerOpen(true);
  }, [autoOpenComposer]);

  const refetch = useCallback(async (nextLens: Lens) => {
    setLoading(true);
    setError(null);
    try {
      const scope = nextLens === 'yours' ? 'mine' : 'discoverable';
      const data = await apiGetKrews({ limit: 40, scope });
      setKrews(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch(lens);
  }, [lens, refetch]);

  // Join (or ask to join) straight from a Discover row. The Krew comes back
  // with the viewer's new standing, which replaces the row in place.
  const handleJoin = useCallback((krew: ApiKrewJSON) => {
    setJoiningId(krew.id);
    setError(null);
    apiJoinKrew(krew.id)
      .then((updated) => {
        setKrews((list) =>
          list.map((k) => (k.id === updated.id ? updated : k)),
        );
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        setJoiningId(null);
      });
  }, []);

  const returnToSource = useKonnectReturn();
  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    // Opened from a record (`?konnect=`): back to it.
    if (returnToSource('/hub/krew')) return;
    // If we arrived via the composer route (`/composer` or legacy
    // `/new`), drop back to the plain directory URL so the composer
    // doesn't reopen on refresh.
    if (autoOpenComposer) history.replace('/hub/krew');
  }, [autoOpenComposer, history, returnToSource]);

  const closeProjekt = useCallback(() => {
    if (returnToSource('/hub/krew')) return;
    history.replace('/hub/krew');
  }, [history, returnToSource]);
  const handleProjektSaved = useCallback(
    (project: FtdProject) => {
      history.replace(projectPath(project));
    },
    [history],
  );

  const handleCreated = useCallback(
    (created: ApiKrewJSON) => {
      setComposerOpen(false);
      history.push(`/hub/krew/${created.slug}`);
    },
    [history],
  );

  const emptyMessages = useMemo(
    () =>
      lens === 'yours'
        ? { title: messages.emptyYoursTitle, body: messages.emptyYoursBody }
        : {
            title: messages.emptyDiscoverTitle,
            body: messages.emptyDiscoverBody,
          },
    [lens],
  );

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <div className='scrollable krew-page'>
        <FeedDrum
          reach={lens}
          order={['yours', 'discover']}
          onScopeChange={handleLensChange}
        >
          {error && <p className='krew-page__error'>{error}</p>}

          {loading && (
            <p className='krew-page__loading'>
              <FormattedMessage {...messages.loading} />
            </p>
          )}

          {!loading && krews.length === 0 && (
            <div className='krew-page__empty'>
              <h2 className='krew-page__empty-title'>
                <FormattedMessage {...emptyMessages.title} />
              </h2>
              <p className='krew-page__empty-body'>
                <FormattedMessage {...emptyMessages.body} />
              </p>
            </div>
          )}

          {!loading && krews.length > 0 && (
            <ul className='krew-page__list'>
              {krews.map((krew) => (
                <KrewRow
                  key={krew.id}
                  krew={krew}
                  onJoin={lens === 'discover' ? handleJoin : undefined}
                  busy={joiningId === krew.id}
                />
              ))}
            </ul>
          )}
        </FeedDrum>
      </div>

      {composerOpen && (
        <KrewComposer onCancel={closeComposer} onCreated={handleCreated} />
      )}
      {autoOpenProjekt && (
        <ProjectComposer onCancel={closeProjekt} onSaved={handleProjektSaved} />
      )}
    </Stage>
  );
};
