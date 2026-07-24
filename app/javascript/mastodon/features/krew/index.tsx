import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Link, useLocation } from 'react-router-dom';

import { apiGetKrews } from 'mastodon/api/krew';
import type { ApiKrewJSON } from 'mastodon/api/krew';
import { Stage } from 'mastodon/components/stage';

// Krews landing (/hub/krew). Two lenses per KRONK_KREWS §7.1:
//   Yours     — the current account's memberships, ordered by
//               last_activity_at desc.
//   Discover  — listed Krews with the current account's join state.
// Redesigned 2026-07-24 — centered column, real hero, chunky
// segmented control + primary CTA, empty state as a proper card.
// CSS classes moved to the `.krew-page__*` namespace so the
// aesthetic reads coherently with Hub / Kalendar Spiral.

const messages = defineMessages({
  title: { id: 'krew.title', defaultMessage: 'Krews' },
  new: { id: 'krew.new', defaultMessage: 'Plant a new Krew' },
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
      'Plant one to share with a defined group — or switch to Discover to find one to join.',
  },
  emptyDiscoverTitle: {
    id: 'krew.empty.discover_title',
    defaultMessage: 'No Krews to discover just yet.',
  },
  emptyDiscoverBody: {
    id: 'krew.empty.discover_body',
    defaultMessage: 'Be the first — plant one and others can join.',
  },
  inviteOnly: {
    id: 'krew.marker.invite_only',
    defaultMessage: 'Invite-only',
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

const KrewRow: React.FC<{ krew: ApiKrewJSON }> = ({ krew }) => {
  const intl = useIntl();
  return (
    <li className='krew-page__row'>
      <Link to={`/hub/krew/${krew.slug}`} className='krew-page__row-link'>
        <span
          className='krew-page__row-avatar'
          aria-hidden='true'
          data-initial={initialSquircle(krew.name)}
        >
          {initialSquircle(krew.name)}
        </span>
        <div className='krew-page__row-body'>
          <div className='krew-page__row-title'>
            <h3 className='krew-page__row-name'>{krew.name}</h3>
            {krew.access === 'invite_only' && (
              <span
                className='krew-page__row-marker'
                aria-label={intl.formatMessage(messages.inviteOnly)}
                title={intl.formatMessage(messages.inviteOnly)}
              >
                ⚿
              </span>
            )}
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
    </li>
  );
};

export const Krews = () => {
  const intl = useIntl();
  // The lens is the SpaceNav view — derived from the URL so the shared
  // AutoSpaceViewPicker drives it. `/hub/krew` = Yours (default),
  // `/hub/krew/discover` = Discover. No in-page tab state.
  const location = useLocation();
  const lens: Lens = location.pathname.endsWith('/discover')
    ? 'discover'
    : 'yours';
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
        <div className='krew-page__toolbar'>
          <Link to='/hub/krew/new' className='krew-page__cta'>
            <span className='krew-page__cta-plus' aria-hidden='true'>
              +
            </span>
            <FormattedMessage {...messages.new} />
          </Link>
        </div>

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
            <Link to='/hub/krew/new' className='krew-page__cta'>
              <span className='krew-page__cta-plus' aria-hidden='true'>
                +
              </span>
              <FormattedMessage {...messages.new} />
            </Link>
          </div>
        )}

        {!loading && krews.length > 0 && (
          <ul className='krew-page__list'>
            {krews.map((krew) => (
              <KrewRow key={krew.id} krew={krew} />
            ))}
          </ul>
        )}
      </div>
    </Stage>
  );
};
