import { useCallback } from 'react';

import type { ApiNudgeConversationJSON } from 'mastodon/api_types/nudges_conversations';
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

  const account = conversation.other_account
    ? createAccountFromServerJSON(conversation.other_account)
    : null;

  const displayName =
    account?.display_name ?? account?.username ?? 'Conversation';

  return (
    <li
      className={`nudges-row ${active ? 'nudges-row--active' : ''} ${
        conversation.unread_count > 0 ? 'nudges-row--unread' : ''
      }`}
    >
      <button
        type='button'
        className='nudges-row__button'
        onClick={handleClick}
      >
        <span className='nudges-row__avatar'>
          {account && <Avatar account={account} size={40} />}
        </span>
        <span className='nudges-row__body'>
          <span className='nudges-row__head'>
            <span className='nudges-row__name'>{displayName}</span>
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
