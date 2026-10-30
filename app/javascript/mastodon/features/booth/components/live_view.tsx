import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link, useHistory, useLocation } from 'react-router-dom';

import { EmptyState } from 'mastodon/components/empty_state';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LoadingState } from 'mastodon/components/loading_state';
import type { ReachValue } from 'mastodon/components/reach_dropdown';

import type { BoothLive } from '../types';
import { useBoothLives } from '../use_booth_lives';

import { LiveRoom } from './live_room';
import { RemindButton } from './remind_button';

// The Live view (`/hub/booth/live`): what's on now and what's coming, and
// one live set's room at `/hub/booth/live/:id`. `<LiveNowStrip>` is the
// same "live now" list in brief, at the top of Musik.

const messages = defineMessages({
  loading: { id: 'booth.live.list_loading', defaultMessage: 'Loading…' },
  liveNow: { id: 'booth.live.now_heading', defaultMessage: 'Live now' },
  comingUp: { id: 'booth.live.coming_up', defaultMessage: 'Coming up' },
  listen: { id: 'booth.live.listen', defaultMessage: 'Listen in' },
  empty: {
    id: 'booth.live.empty',
    defaultMessage: 'Nothing live right now',
  },
  emptyBody: {
    id: 'booth.live.empty_body',
    defaultMessage:
      'Play a set live for members, or schedule one so people can plan to tune in.',
  },
  goLive: { id: 'booth.live.go_live', defaultMessage: 'Go live' },
  host: { id: 'booth.live.by', defaultMessage: 'by {name}' },
});

interface LocationState {
  announce?: ReachValue | null;
}

function liveIdFromPath(pathname: string): string | null {
  return /^\/hub\/booth\/live\/(\d+)/.exec(pathname)?.[1] ?? null;
}

const hostName = (live: BoothLive) =>
  live.account.display_name || live.account.username;

export const LiveCard: React.FC<{
  live: BoothLive;
  onChange?: (live: BoothLive) => void;
}> = ({ live, onChange }) => {
  const intl = useIntl();
  const startsAt = new Date(live.starts_at);
  return (
    <li className='booth-live-card-row'>
      <Link
        to={`/hub/booth/live/${live.id}`}
        className={`booth-live-card booth-live-card--${live.state}`}
      >
        <span className='booth-live-card__when'>
          {live.state === 'live' ? (
            <span className='booth-live__badge'>
              {intl.formatMessage(messages.liveNow)}
            </span>
          ) : (
            <>
              <span className='booth-live-card__day'>
                {intl.formatDate(startsAt, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
              <span className='booth-live-card__time'>
                {intl.formatTime(startsAt, {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
            </>
          )}
        </span>
        <span className='booth-live-card__what'>
          <span className='booth-live-card__title'>{live.title}</span>
          <span className='booth-live-card__meta'>
            {intl.formatMessage(messages.host, { name: hostName(live) })}
            {live.genres.length > 0 && ` · ${live.genres.join(', ')}`}
          </span>
        </span>
        {live.state === 'live' && (
          <span className='booth-live-card__cta'>
            {intl.formatMessage(messages.listen)}
          </span>
        )}
      </Link>
      <RemindButton live={live} onChange={onChange} />
    </li>
  );
};

// Go live, as a big filled button wherever the Booth offers it (Tal's
// proposal "'Go live' button": a text link was easy to miss).
export const GoLiveButton: React.FC = () => {
  const intl = useIntl();
  const history = useHistory();
  const handleClick = useCallback(() => {
    history.push('/hub/booth/composer/live');
  }, [history]);
  return (
    <KornerPill
      variant='primary'
      className='booth-live__go-button'
      label={intl.formatMessage(messages.goLive)}
      onClick={handleClick}
    />
  );
};

export const LiveView: React.FC = () => {
  const intl = useIntl();
  const location = useLocation<LocationState | undefined>();
  const id = liveIdFromPath(location.pathname);
  const { lives, loading, replace } = useBoothLives();

  if (id) {
    return <LiveRoom id={id} announce={location.state?.announce ?? null} />;
  }
  if (loading) {
    return <LoadingState label={intl.formatMessage(messages.loading)} />;
  }

  const now = lives.filter((l) => l.state === 'live');
  const upcoming = lives.filter((l) => l.state === 'scheduled');

  if (lives.length === 0) {
    return (
      <EmptyState
        title={intl.formatMessage(messages.empty)}
        body={intl.formatMessage(messages.emptyBody)}
        action={<GoLiveButton />}
      />
    );
  }

  return (
    <div className='booth-live-list'>
      <div className='booth-live-list__go'>
        <GoLiveButton />
      </div>
      {now.length > 0 && (
        <section>
          <h2 className='booth-set__section-title'>
            {intl.formatMessage(messages.liveNow)}
          </h2>
          <ul>
            {now.map((l) => (
              <LiveCard key={l.id} live={l} />
            ))}
          </ul>
        </section>
      )}
      {upcoming.length > 0 && (
        <section>
          <h2 className='booth-set__section-title'>
            {intl.formatMessage(messages.comingUp)}
          </h2>
          <ul>
            {upcoming.map((l) => (
              <LiveCard key={l.id} live={l} onChange={replace} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

// "Live now" at the top of Musik, only while something is live.
export const LiveNowStrip: React.FC = () => {
  const intl = useIntl();
  const { lives } = useBoothLives();
  const now = lives.filter((l) => l.state === 'live');
  if (now.length === 0) return null;

  return (
    <section
      className='booth-live-strip'
      aria-label={intl.formatMessage(messages.liveNow)}
    >
      <ul>
        {now.slice(0, 3).map((l) => (
          <LiveCard key={l.id} live={l} />
        ))}
      </ul>
    </section>
  );
};
