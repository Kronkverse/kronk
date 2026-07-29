// Grid of the viewer's active moments — v1 layout. A future slice
// swaps this for the mates-scoped grid the brief describes.

import { useEffect, useState } from 'react';

import { FormattedMessage, FormattedRelativeTime } from 'react-intl';

import { apiRequestGet } from 'mastodon/api';

interface MediaAttachment {
  id: string;
  preview_url: string;
  type: string;
}

interface MomentJSON {
  id: string;
  caption: string | null;
  expires_at: string;
  active: boolean;
  froth_count: number;
  media_attachment: MediaAttachment;
}

export const MomentsGrid = ({ refreshTick }: { refreshTick: number }) => {
  const [moments, setMoments] = useState<MomentJSON[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiRequestGet<MomentJSON[]>('v1/moments')
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
  }, [refreshTick]);

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
          defaultMessage="Couldn't load your Moments."
        />
      </div>
    );
  }

  if (moments.length === 0) {
    return (
      <div className='moments__empty'>
        <FormattedMessage
          id='moments.grid.empty'
          defaultMessage='No active Moments. Share one — it will be gone by morning.'
        />
      </div>
    );
  }

  return (
    <div className='moments__grid'>
      {moments.map((moment) => (
        <MomentTile key={moment.id} moment={moment} />
      ))}
    </div>
  );
};

const MomentTile = ({ moment }: { moment: MomentJSON }) => {
  const secondsUntilExpiry = Math.round(
    (new Date(moment.expires_at).getTime() - Date.now()) / 1000,
  );
  return (
    <a href={`/hub/moments/${moment.id}`} className='moments__tile'>
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
      </div>
      <div className='moments__tile-meta'>
        {moment.caption && (
          <span className='moments__tile-caption'>{moment.caption}</span>
        )}
        <span className='moments__tile-expiry'>
          <FormattedMessage
            id='moments.tile.gone'
            defaultMessage='Gone {when}'
            values={{
              when: (
                <FormattedRelativeTime
                  value={secondsUntilExpiry}
                  numeric='auto'
                  updateIntervalInSeconds={60}
                />
              ),
            }}
          />
        </span>
        {moment.froth_count > 0 && (
          <span className='moments__tile-froths'>♥ {moment.froth_count}</span>
        )}
      </div>
    </a>
  );
};
