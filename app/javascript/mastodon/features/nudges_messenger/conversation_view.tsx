import { useEffect, useRef, useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import {
  apiSendNudgeMessage,
  apiGetNudgeConversation,
  apiMarkNudgeConversationRead,
} from 'mastodon/api/nudges_conversations';
import type { ApiNudgeConversationDetail } from 'mastodon/api_types/nudges_conversations';
import { Avatar } from 'mastodon/components/avatar';
import { createAccountFromServerJSON } from 'mastodon/models/account';

import { Composer } from './composer';
import { StreamItem } from './stream_item';

const messages = defineMessages({
  loading: { id: 'nudges.loading', defaultMessage: 'Loading…' },
  unavailable: {
    id: 'nudges.conversation_unavailable',
    defaultMessage: 'Conversation not available.',
  },
});

interface ConversationViewProps {
  conversationId: string;
  detail: ApiNudgeConversationDetail | null;
  loading: boolean;
  onMessageSent: (next: ApiNudgeConversationDetail) => void;
}

export const ConversationView: React.FC<ConversationViewProps> = ({
  conversationId,
  detail,
  loading,
  onMessageSent,
}) => {
  const intl = useIntl();
  const streamEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on load / message.
  useEffect(() => {
    if (streamEndRef.current) {
      streamEndRef.current.scrollIntoView({ block: 'end' });
    }
  }, [detail?.stream.length]);

  // On open, mark read.
  useEffect(() => {
    if (!detail || detail.conversation.unread_count === 0) return;
    void apiMarkNudgeConversationRead(conversationId);
  }, [conversationId, detail]);

  const handleSend = useCallback(
    async (body: string) => {
      if (!body.trim()) return;
      await apiSendNudgeMessage(conversationId, body.trim());
      const refreshed = await apiGetNudgeConversation(conversationId);
      onMessageSent(refreshed);
    },
    [conversationId, onMessageSent],
  );

  if (loading && !detail) {
    return (
      <p className='nudges-conversation__status'>
        {intl.formatMessage(messages.loading)}
      </p>
    );
  }

  if (!detail) {
    return (
      <p className='nudges-conversation__status'>
        {intl.formatMessage(messages.unavailable)}
      </p>
    );
  }

  const other = detail.conversation.other_account
    ? createAccountFromServerJSON(detail.conversation.other_account)
    : null;
  const otherName = other?.display_name ?? other?.username ?? 'Conversation';

  // Stream is delivered most-recent-first; render oldest-first so a
  // new message appears at the bottom.
  const oldestFirst = [...detail.stream].reverse();

  return (
    <div className='nudges-conversation'>
      <header className='nudges-conversation__head'>
        {other && <Avatar account={other} size={32} />}
        <span className='nudges-conversation__name'>{otherName}</span>
      </header>

      <div className='nudges-conversation__stream'>
        {oldestFirst.map((item) => (
          <StreamItem key={`${item.kind}-${item.id}`} item={item} />
        ))}
        <div ref={streamEndRef} />
      </div>

      <Composer onSend={handleSend} />
    </div>
  );
};
