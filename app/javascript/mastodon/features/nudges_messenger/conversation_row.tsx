import { useCallback } from 'react';

import GroupsIcon from '@/material-icons/400-24px/groups.svg?react';
import MutedIcon from '@/material-icons/400-24px/volume_off-fill.svg?react';
import type {
  ApiNudgeConversationJSON,
  ApiNudgeKrewJSON,
} from 'mastodon/api_types/nudges_conversations';
import { Avatar } from 'mastodon/components/avatar';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';
import { createAccountFromServerJSON } from 'mastodon/models/account';

interface ConversationRowProps {
  conversation: ApiNudgeConversationJSON;
  active: boolean;
  onOpen: (id: string) => void;
}

export const ConversationRow: React.FC<ConversationRowProps> = ({
  conversation,
  active,
  onOpen,
}) => {
  const handleClick = useCallback(() => {
    onOpen(conversation.id);
  }, [conversation.id, onOpen]);

  const isKrew = conversation.kind === 'krew';

  return (
    <li
      className={`nudges-row ${active ? 'nudges-row--active' : ''} ${
        conversation.unread_count > 0 ? 'nudges-row--unread' : ''
      } ${conversation.muted ? 'nudges-row--muted' : ''}`}
    >
      <button
        type='button'
        className='nudges-row__button'
        onClick={handleClick}
      >
        <span className='nudges-row__avatar'>
          {isKrew ? (
            <KrewAvatar krew={conversation.krew} />
          ) : (
            <MateAvatar account={conversation.other_account} />
          )}
        </span>
        <span className='nudges-row__body'>
          <span className='nudges-row__head'>
            <span className='nudges-row__name'>{titleFor(conversation)}</span>
            {conversation.muted && (
              <span
                className='nudges-row__muted-icon'
                aria-label='Muted'
                title='Muted'
              >
                <MutedIcon />
              </span>
            )}
            {conversation.last_activity_at && (
              <span className='nudges-row__time'>
                <RelativeTimestamp
                  timestamp={conversation.last_activity_at}
                  short
                />
              </span>
            )}
          </span>
          <span className='nudges-row__preview'>
            {conversation.latest_kind === 'event' && (
              <span
                className='nudges-row__preview-dot'
                aria-hidden
                title='Nudge'
              />
            )}
            {conversation.preview}
          </span>
        </span>
        {conversation.unread_count > 0 && (
          <span
            className='nudges-row__badge'
            aria-label={`${conversation.unread_count} unread`}
          >
            {conversation.unread_count}
          </span>
        )}
      </button>
    </li>
  );
};

const titleFor = (c: ApiNudgeConversationJSON) => {
  if (c.kind === 'krew') return c.krew?.name ?? 'Krew';
  if (c.other_account) {
    return c.other_account.display_name || c.other_account.username;
  }
  return 'Conversation';
};

const MateAvatar: React.FC<{
  account: ApiNudgeConversationJSON['other_account'];
}> = ({ account }) => {
  if (!account) return null;
  const shape = createAccountFromServerJSON(account);
  return <Avatar account={shape} size={40} />;
};

const KrewAvatar: React.FC<{ krew: ApiNudgeKrewJSON | null }> = ({ krew }) => {
  const urls = krew?.avatar_urls ?? [];
  if (urls.length === 0) {
    return (
      <span
        className='nudges-row__krew-avatar'
        aria-label={krew?.name ?? 'Krew'}
        title={krew?.name}
      >
        <GroupsIcon />
      </span>
    );
  }
  return (
    <span
      className='nudges-row__krew-stack'
      aria-label={krew?.name ?? 'Krew'}
      title={krew?.name}
    >
      {urls.slice(0, 2).map((url, i) => (
        <img
          key={url}
          className={`nudges-row__krew-stack-avatar nudges-row__krew-stack-avatar--${i}`}
          src={url}
          alt=''
        />
      ))}
    </span>
  );
};
