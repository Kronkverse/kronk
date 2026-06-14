import { useCallback, useState } from 'react';

import FavoriteIcon from '@/material-icons/400-24px/favorite-fill.svg?react';
import FavoriteBorderIcon from '@/material-icons/400-24px/favorite.svg?react';
import api from 'mastodon/api';

interface Reactions {
  heart: { me: boolean; others: boolean };
}

export const StatusMomentCard: React.FC<{
  statusId: string;
  contentHtml: string;
  reactions?: Reactions;
  onCardClick?: (e: React.MouseEvent) => void;
}> = ({ statusId, contentHtml, reactions: initialReactions, onCardClick }) => {
  const [reactions, setReactions] = useState<Reactions | undefined>(
    initialReactions,
  );

  const handleHeartClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const me = reactions?.heart.me ?? false;
      const client = api();
      const request = me
        ? client.delete<Reactions>(
            `/api/v1/statuses/${statusId}/moment_react/heart`,
          )
        : client.post<Reactions>(
            `/api/v1/statuses/${statusId}/moment_react/heart`,
          );
      void request
        .then((res) => {
          setReactions(res.data);
        })
        .catch(() => {
          // ignore
        });
    },
    [reactions, statusId],
  );

  const handleCardKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && onCardClick) {
        onCardClick(e as unknown as React.MouseEvent);
      }
    },
    [onCardClick],
  );

  const me = reactions?.heart.me ?? false;
  const others = reactions?.heart.others ?? false;

  return (
    <div
      className='status-moment-card'
      onClick={onCardClick}
      onKeyDown={handleCardKeyDown}
      role={onCardClick ? 'button' : undefined}
      tabIndex={onCardClick ? 0 : undefined}
    >
      {contentHtml && (
        <div
          className='status-moment-card__body'
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
      )}

      {reactions && (
        <div className='status-moment-card__reactions'>
          <button
            type='button'
            className={`status-moment-card__reaction${me ? ' status-moment-card__reaction--active' : ''}`}
            onClick={handleHeartClick}
            aria-pressed={me}
            aria-label='heart'
          >
            <span className='status-moment-card__reaction-icon'>
              {me ? (
                <FavoriteIcon
                  style={{ fill: '#c97d3a', width: 20, height: 20 }}
                />
              ) : (
                <FavoriteBorderIcon style={{ width: 20, height: 20 }} />
              )}
            </span>
            {others && <span className='status-moment-card__reaction-dot' />}
          </button>
        </div>
      )}
    </div>
  );
};
