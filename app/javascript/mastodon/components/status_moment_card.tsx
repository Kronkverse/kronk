import { useCallback, useState } from 'react';

import api from 'mastodon/api';

const EMOJI_MAP: Record<string, string> = {
  froth: '🥹',
  heart: '❤️',
  laugh: '😂',
  cry: '😢',
};

type MomentEmoji = 'froth' | 'heart' | 'laugh' | 'cry';

type Reactions = Record<MomentEmoji, { me: boolean; others: boolean }>;

const ReactionButton: React.FC<{
  emoji: MomentEmoji;
  me: boolean;
  others: boolean;
  statusId: string;
  onReacted: (reactions: Reactions) => void;
}> = ({ emoji, me, others, statusId, onReacted }) => {
  const doReact = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      const method = me ? 'delete' : 'post';
      try {
        const res = await api()[method]<Reactions>(
          `/api/v1/statuses/${statusId}/moment_react/${emoji}`,
        );
        onReacted(res.data);
      } catch {
        // ignore
      }
    },
    [emoji, me, statusId, onReacted],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      void doReact(e);
    },
    [doReact],
  );

  return (
    <button
      type='button'
      className={`status-moment-card__reaction${me ? ' status-moment-card__reaction--active' : ''}`}
      onClick={handleClick}
      aria-pressed={me}
      aria-label={emoji}
    >
      <span className='status-moment-card__reaction-emoji'>
        {EMOJI_MAP[emoji]}
      </span>
      {others && <span className='status-moment-card__reaction-dot' />}
    </button>
  );
};

export const StatusMomentCard: React.FC<{
  statusId: string;
  contentHtml: string;
  reactions?: Reactions;
  onCardClick?: (e: React.MouseEvent) => void;
}> = ({ statusId, contentHtml, reactions: initialReactions, onCardClick }) => {
  const [reactions, setReactions] = useState<Reactions | undefined>(
    initialReactions,
  );

  const handleCardKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && onCardClick) {
        onCardClick(e as unknown as React.MouseEvent);
      }
    },
    [onCardClick],
  );

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
          {(Object.keys(EMOJI_MAP) as MomentEmoji[]).map((emoji) => (
            <ReactionButton
              key={emoji}
              emoji={emoji}
              me={reactions[emoji].me}
              others={reactions[emoji].others}
              statusId={statusId}
              onReacted={setReactions}
            />
          ))}
        </div>
      )}
    </div>
  );
};
