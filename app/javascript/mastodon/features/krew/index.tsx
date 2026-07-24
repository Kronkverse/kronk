import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Link } from 'react-router-dom';

import { apiGetKrews } from 'mastodon/api/krew';
import type { ApiKrewJSON } from 'mastodon/api/krew';
import { Stage } from 'mastodon/components/stage';

// Krews landing (/hub/krew). Two lenses per KRONK_KREWS §7.1:
//   Yours     — the current account's memberships, ordered by
//               last_activity_at desc.
//   Discover  — listed Krews with the current account's join state.
// Discover-side name search + live-reorder FLIP animation are
// deferred to a follow-up so this PR lands the surface skeleton
// first. CSS classes still say `groups-page__*` — the SCSS-only
// classname sweep is queued.

const messages = defineMessages({
  title: { id: 'krew.title', defaultMessage: 'Krews' },
  yours: { id: 'krew.lens.yours', defaultMessage: 'Yours' },
  discover: { id: 'krew.lens.discover', defaultMessage: 'Discover' },
  new: { id: 'krew.new', defaultMessage: '+ Plant a new krew' },
  members: {
    id: 'krew.members_count',
    defaultMessage: '{count, plural, one {# member} other {# members}}',
  },
  loading: { id: 'krew.loading', defaultMessage: 'Loading…' },
  emptyYours: {
    id: 'krew.empty.yours',
    defaultMessage: "You're not in any Krews yet.",
  },
  emptyDiscover: {
    id: 'krew.empty.discover',
    defaultMessage: 'No Krews to discover just yet.',
  },
});

type Lens = 'yours' | 'discover';

const initialSquircle = (name: string): string => {
  const trimmed = name.trim();
  const first = trimmed.charAt(0);
  return first.length === 0 ? 'K' : first.toUpperCase();
};

// Relative-time helper — spec is "relative time" (§7.1) but we render
// a plain readable format for now; a full FormattedRelativeTime pass
// lands with the unread-badge wiring.
const relativeTime = (iso: string | null): string => {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const now = Date.now();
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  return `${weeks}w ago`;
};

const KrewRow: React.FC<{ krew: ApiKrewJSON }> = ({ krew }) => {
  const intl = useIntl();
  return (
    <li className='groups-page__row'>
      <Link to={`/hub/krew/${krew.slug}`}>
        <div className='groups-page__row-header'>
          <span
            className='groups-page__row-avatar'
            aria-hidden='true'
            data-initial={initialSquircle(krew.name)}
          >
            {initialSquircle(krew.name)}
          </span>
          <h3 className='groups-page__row-name'>
            {krew.name}
            {krew.access === 'invite_only' && (
              <span
                className='groups-page__row-marker'
                aria-label='Invite-only'
              >
                {' '}
                ⚿
              </span>
            )}
          </h3>
          <small className='groups-page__row-meta'>
            {intl.formatMessage(messages.members, { count: krew.member_count })}
            {krew.last_activity_at
              ? ` · ${relativeTime(krew.last_activity_at)}`
              : ''}
          </small>
        </div>
        {krew.description && (
          <p className='groups-page__row-desc'>{krew.description}</p>
        )}
      </Link>
    </li>
  );
};

export const Krews = () => {
  const intl = useIntl();
  const [lens, setLens] = useState<Lens>('yours');
  const [krews, setKrews] = useState<ApiKrewJSON[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const handleYours = useCallback(() => {
    setLens('yours');
  }, []);
  const handleDiscover = useCallback(() => {
    setLens('discover');
  }, []);

  const emptyMessage = useMemo(
    () => (lens === 'yours' ? messages.emptyYours : messages.emptyDiscover),
    [lens],
  );

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <div className='scrollable groups-page'>
        <div className='groups-page__scope-tabs'>
          <button
            type='button'
            onClick={handleYours}
            className={`groups-page__scope-tab ${lens === 'yours' ? 'groups-page__scope-tab--active' : ''}`}
          >
            {intl.formatMessage(messages.yours)}
          </button>
          <button
            type='button'
            onClick={handleDiscover}
            className={`groups-page__scope-tab ${lens === 'discover' ? 'groups-page__scope-tab--active' : ''}`}
          >
            {intl.formatMessage(messages.discover)}
          </button>
        </div>

        <Link to='/hub/krew/new' className='groups-page__new-btn'>
          {intl.formatMessage(messages.new)}
        </Link>

        {error && <p className='groups-page__error'>{error}</p>}

        {loading && (
          <p className='groups-page__loading'>
            {intl.formatMessage(messages.loading)}
          </p>
        )}

        {!loading && krews.length === 0 && (
          <p className='groups-page__empty'>
            <FormattedMessage {...emptyMessage} />
          </p>
        )}

        <ul className='groups-page__list'>
          {krews.map((krew) => (
            <KrewRow key={krew.id} krew={krew} />
          ))}
        </ul>
      </div>
    </Stage>
  );
};
