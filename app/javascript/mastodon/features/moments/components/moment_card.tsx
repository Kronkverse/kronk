import { useCallback, useState } from 'react';

import { defineMessages, useIntl, FormattedRelativeTime } from 'react-intl';

import api from 'mastodon/api';
import type { ApiStatusJSON } from 'mastodon/api_types/statuses';

const messages = defineMessages({
  expires: {
    id: 'moments.expires_in',
    defaultMessage: 'Expires {time}',
  },
});

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
      className={`moment-card__reaction${me ? ' moment-card__reaction--active' : ''}`}
      onClick={handleClick}
      aria-pressed={me}
      aria-label={emoji}
    >
      <span className='moment-card__reaction-emoji'>{EMOJI_MAP[emoji]}</span>
      {others && <span className='moment-card__reaction-dot' />}
    </button>
  );
};

export const MomentCard: React.FC<{ moment: ApiStatusJSON }> = ({ moment }) => {
  const intl = useIntl();
  const [reactions, setReactions] = useState<Reactions | undefined>(
    moment.moment_reactions as Reactions | undefined,
  );
  const expiresAt = moment.expires_at ? new Date(moment.expires_at) : null;
  const secondsUntilExpiry = expiresAt
    ? Math.round((expiresAt.getTime() - Date.now()) / 1000)
    : null;

  return (
    <div className='moment-card'>
      {moment.content && (
        <div
          className='moment-card__body'
          dangerouslySetInnerHTML={{ __html: moment.content }}
        />
      )}
      {moment.media_attachments.length > 0 && (
        <div className='moment-card__media'>
          {moment.media_attachments.map((attachment) => (
            <img
              key={attachment.id}
              className='moment-card__image'
              src={attachment.preview_url}
              alt={attachment.description ?? ''}
            />
          ))}
        </div>
      )}
      {reactions && (
        <div className='moment-card__reactions'>
          {(Object.keys(EMOJI_MAP) as MomentEmoji[]).map((emoji) => (
            <ReactionButton
              key={emoji}
              emoji={emoji}
              me={reactions[emoji].me}
              others={reactions[emoji].others}
              statusId={moment.id}
              onReacted={setReactions}
            />
          ))}
        </div>
      )}
      {secondsUntilExpiry !== null && (
        <div className='moment-card__expiry'>
          {intl.formatMessage(messages.expires, {
            time: (
              <FormattedRelativeTime
                value={secondsUntilExpiry}
                updateIntervalInSeconds={60}
              />
            ),
          })}
        </div>
      )}
    </div>
  );
};
