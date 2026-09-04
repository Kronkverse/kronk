// A grid of Moments the viewer is allowed to see (reach-ladder gated,
// server-side). `filter='active'` is the 24h window (the korner's top
// section); `filter='log'` is the permanent archive. Since the grid now
// spans many authors, each tile shows whose Moment it is.

import { useEffect, useState } from 'react';

import { FormattedMessage, FormattedRelativeTime } from 'react-intl';

import { Link } from 'react-router-dom';

import { apiRequestGet } from 'mastodon/api';

import { scaleRelativeExpiry } from './relative_expiry';

interface MediaAttachment {
  id: string;
  preview_url: string;
  type: string;
}

interface AccountJSON {
  id: string;
  acct: string;
  display_name: string;
  avatar: string;
}

interface MomentJSON {
  id: string;
  caption: string | null;
  expires_at: string;
  active: boolean;
  froth_count: number;
  account: AccountJSON;
  media_attachment: MediaAttachment;
}

type Filter = 'active' | 'log';

export const MomentsGrid = ({
  refreshTick,
  filter = 'active',
}: {
  refreshTick: number;
  filter?: Filter;
}) => {
  const [moments, setMoments] = useState<MomentJSON[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiRequestGet<MomentJSON[]>('v1/moments', { filter })
      .then((data) => {
        if (cancelled) return;
        setMoments(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('load-failed');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshTick, filter]);

  if (loading) {
    return (
      <div className='moments__loading'>
        <FormattedMessage
          id='moments.grid.loading'
          defaultMessage='Loading Moments…'
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className='moments__error'>
        <FormattedMessage
          id='moments.grid.error'
          defaultMessage="Couldn't load Moments."
        />
      </div>
    );
  }

  if (moments.length === 0) {
    return (
      <div className='moments__empty'>
        {filter === 'log' ? (
          <FormattedMessage
            id='moments.grid.empty_log'
            defaultMessage='Nothing in the log yet. Moments land here once their 24 hours are up.'
          />
        ) : (
          <FormattedMessage
            id='moments.grid.empty'
            defaultMessage='No active Moments. Share one — it will be gone by morning.'
          />
        )}
      </div>
    );
  }

  return (
    <div className='moments__grid'>
      {moments.map((moment) => (
        <MomentTile key={moment.id} moment={moment} filter={filter} />
      ))}
    </div>
  );
};

const MomentTile = ({
  moment,
  filter,
}: {
  moment: MomentJSON;
  filter: Filter;
}) => {
  const secondsUntilExpiry = Math.round(
    (new Date(moment.expires_at).getTime() - Date.now()) / 1000,
  );
  const scaled = scaleRelativeExpiry(secondsUntilExpiry);
  return (
    <Link to={`/hub/moments/${moment.id}`} className='moments__tile'>
      <div className='moments__tile-media'>
        {moment.media_attachment.type === 'video' ? (
          <video
            className='moments__tile-video'
            src={moment.media_attachment.preview_url}
            muted
            playsInline
            loop
          />
        ) : (
          <img
            className='moments__tile-image'
            src={moment.media_attachment.preview_url}
            alt={moment.caption ?? ''}
          />
        )}
        <span className='moments__tile-author'>
          <img
            className='moments__tile-avatar'
            src={moment.account.avatar}
            alt=''
            aria-hidden
          />
          <span className='moments__tile-author-name'>
            {moment.account.display_name || `@${moment.account.acct}`}
          </span>
        </span>
      </div>
      <div className='moments__tile-meta'>
        {moment.caption && (
          <span className='moments__tile-caption'>{moment.caption}</span>
        )}
        <span className='moments__tile-expiry'>
          {filter === 'log' ? (
            <FormattedMessage
              id='moments.tile.was_gone'
              defaultMessage='Gone {when}'
              values={{
                when: (
                  <FormattedRelativeTime
                    value={scaled.value}
                    unit={scaled.unit}
                    numeric='auto'
                    updateIntervalInSeconds={undefined}
                  />
                ),
              }}
            />
          ) : (
            <FormattedMessage
              id='moments.tile.gone'
              defaultMessage='Gone {when}'
              values={{
                when: (
                  <FormattedRelativeTime
                    value={scaled.value}
                    unit={scaled.unit}
                    numeric='auto'
                    updateIntervalInSeconds={60}
                  />
                ),
              }}
            />
          )}
        </span>
        {moment.froth_count > 0 && (
          <span className='moments__tile-froths'>♥ {moment.froth_count}</span>
        )}
      </div>
    </Link>
  );
};
