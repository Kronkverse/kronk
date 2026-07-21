import React, { useEffect, useRef, useCallback } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import GroupsIcon from '@/material-icons/400-24px/groups.svg?react';
import {
  apiSendNudgeMessage,
  apiDeleteNudgeMessage,
  apiMarkNudgeConversationRead,
  apiAddNudgeReaction,
  apiRemoveNudgeReaction,
} from 'mastodon/api/nudges_conversations';
import type {
  ApiNudgeConversationDetail,
  ApiNudgeMessageJSON,
  ApiNudgeStreamItem,
} from 'mastodon/api_types/nudges_conversations';
import { Avatar } from 'mastodon/components/avatar';
import { createAccountFromServerJSON } from 'mastodon/models/account';

import { Composer } from './composer';
import { DaySeparator } from './day_separator';
import { ExpiryCountdown } from './expiry_countdown';
import { StreamItem } from './stream_item';

// Alias so the import order stays lexicographic without cluttering the read.
const KrewIcon = GroupsIcon;

// Two timestamps land on the same local day.
const sameDay = (a: string, b: string) => {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
};

// Fold a freshly-sent message into the detail without a refetch. The
// server response already has the created message; we just prepend
// it to the (most-recent-first) stream and update the conversation's
// sidebar-shape fields so the row hoists locally.
const applySentMessage = (
  detail: ApiNudgeConversationDetail | null,
  message: ApiNudgeMessageJSON,
): ApiNudgeConversationDetail => {
  if (!detail) throw new Error('applySentMessage called without detail');
  const item: ApiNudgeStreamItem = { kind: 'message', ...message };
  return {
    conversation: {
      ...detail.conversation,
      last_activity_at: message.created_at,
      preview: message.body ?? '📷 media',
      latest_kind: 'message',
    },
    stream: [item, ...detail.stream],
  };
};

// Fold an updated message (e.g. reactions changed) back into the
// stream by matching id. Everything else on the detail is untouched.
const applyUpdatedMessage = (
  detail: ApiNudgeConversationDetail | null,
  message: ApiNudgeMessageJSON,
): ApiNudgeConversationDetail => {
  if (!detail) throw new Error('applyUpdatedMessage called without detail');
  return {
    ...detail,
    stream: detail.stream.map((item) =>
      item.kind === 'message' && item.id === message.id
        ? { kind: 'message', ...message }
        : item,
    ),
  };
};

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

  // Skip-refetch: after each write the server response has enough to
  // update the local detail in place. Halves the round-trip count on
  // every send and every react. Truly optimistic (tempId + rollback
  // on failure) is a follow-up; this is the low-risk first step.
  const handleSend = useCallback(
    async (body: string, mediaAttachmentId?: string) => {
      const trimmed = body.trim();
      if (!trimmed && !mediaAttachmentId) return;
      const created = await apiSendNudgeMessage(
        conversationId,
        trimmed,
        mediaAttachmentId,
      );
      onMessageSent(applySentMessage(detail, created));
    },
    [conversationId, detail, onMessageSent],
  );

  const handleReact = useCallback(
    async (message: ApiNudgeMessageJSON, symbol: string) => {
      const updated = await apiAddNudgeReaction(
        conversationId,
        message.id,
        symbol,
      );
      onMessageSent(applyUpdatedMessage(detail, updated));
    },
    [conversationId, detail, onMessageSent],
  );

  const handleUnreact = useCallback(
    async (message: ApiNudgeMessageJSON, symbol: string) => {
      const updated = await apiRemoveNudgeReaction(
        conversationId,
        message.id,
        symbol,
      );
      onMessageSent(applyUpdatedMessage(detail, updated));
    },
    [conversationId, detail, onMessageSent],
  );

  const handleDelete = useCallback(
    async (message: ApiNudgeMessageJSON) => {
      const tombstoned = await apiDeleteNudgeMessage(
        conversationId,
        message.id,
      );
      onMessageSent(applyUpdatedMessage(detail, tombstoned));
    },
    [conversationId, detail, onMessageSent],
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

  const isKrew = detail.conversation.kind === 'krew';
  const other =
    !isKrew && detail.conversation.other_account
      ? createAccountFromServerJSON(detail.conversation.other_account)
      : null;
  const otherName = other?.display_name ?? other?.username ?? 'Conversation';
  const krewName = detail.conversation.krew?.name ?? 'Krew';

  // Stream is delivered most-recent-first; render oldest-first so a
  // new message appears at the bottom.
  const oldestFirst = [...detail.stream].reverse();

  return (
    <div className='nudges-conversation'>
      <header className='nudges-conversation__head'>
        {isKrew ? (
          <>
            <span className='nudges-conversation__krew-icon' aria-hidden>
              <KrewIcon />
            </span>
            <span className='nudges-conversation__name'>{krewName}</span>
            {detail.conversation.krew && (
              <span className='nudges-conversation__krew-count'>
                <FormattedMessage
                  id='nudges.krew.member_count'
                  defaultMessage='{count, plural, one {# member} other {# members}}'
                  values={{ count: detail.conversation.krew.member_count }}
                />
              </span>
            )}
          </>
        ) : (
          <>
            {other && <Avatar account={other} size={32} />}
            <span className='nudges-conversation__name'>{otherName}</span>
          </>
        )}
        {detail.conversation.expires_at && (
          <ExpiryCountdown expiresAt={detail.conversation.expires_at} />
        )}
      </header>

      <div className='nudges-conversation__stream'>
        {oldestFirst.map((item, index) => {
          const previous = index > 0 ? oldestFirst[index - 1] : null;
          const showDay =
            !previous || !sameDay(previous.created_at, item.created_at);
          return (
            <React.Fragment key={`${item.kind}-${item.id}`}>
              {showDay && <DaySeparator timestamp={item.created_at} />}
              <StreamItem
                item={item}
                conversationKind={detail.conversation.kind}
                onReact={handleReact}
                onUnreact={handleUnreact}
                onDelete={handleDelete}
              />
            </React.Fragment>
          );
        })}
        <div ref={streamEndRef} />
      </div>

      <Composer onSend={handleSend} />
    </div>
  );
};
