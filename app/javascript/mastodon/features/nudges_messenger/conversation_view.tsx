import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useState,
} from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import GroupsIcon from '@/material-icons/400-24px/groups.svg?react';
import {
  apiSendNudgeMessage,
  apiDeleteNudgeMessage,
  apiLeaveNudgeConversation,
  apiMarkNudgeConversationRead,
  apiMuteNudgeConversation,
  apiUnmuteNudgeConversation,
  apiAddNudgeReaction,
  apiRemoveNudgeReaction,
  apiGetNudgeConversationPage,
} from 'mastodon/api/nudges_conversations';
import type {
  ApiNudgeConversationDetail,
  ApiNudgeMessageJSON,
} from 'mastodon/api_types/nudges_conversations';
import { Avatar } from 'mastodon/components/avatar';
import { me } from 'mastodon/initial_state';
import { createAccountFromServerJSON } from 'mastodon/models/account';

import { aggregateStream } from './aggregate_stream';
import { AggregatedEventItem } from './aggregated_event';
import { Composer } from './composer';
import { DaySeparator } from './day_separator';
import { ExpiryCountdown } from './expiry_countdown';
import { StreamItem } from './stream_item';
import { useNudgesConversationStream } from './use_nudges_stream';

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

// Prepend a client-authored optimistic message onto the stream while
// the POST is in-flight. `tempId` starts with `tmp-` so the id space
// can never collide with a server snowflake bigint id.
//
// `author` is a stub — the row is self-authored so the render path
// gates `showSender=false` for both Mate and Krew, and the reaction
// row is suppressed while `sending=true`. When the server row
// arrives, it replaces this stub entirely.
const OPTIMISTIC_AUTHOR_STUB = {
  id: '',
  username: '',
  display_name: '',
} as unknown as ApiNudgeMessageJSON['author'];

const prependOptimistic = (
  detail: ApiNudgeConversationDetail | null,
  tempId: string,
  body: string,
): ApiNudgeConversationDetail => {
  if (!detail) throw new Error('prependOptimistic called without detail');
  const now = new Date().toISOString();
  const optimistic: ApiNudgeMessageJSON = {
    id: tempId,
    conversation_id: detail.conversation.id,
    body: body || null,
    media: [],
    voice: null,
    reactions: [],
    created_at: now,
    deleted: false,
    deleted_at: null,
    author_is_self: true,
    author: OPTIMISTIC_AUTHOR_STUB,
    sending: true,
  };
  return {
    conversation: {
      ...detail.conversation,
      last_activity_at: now,
      preview: body || '📷 media',
      latest_kind: 'message',
    },
    stream: [{ kind: 'message', ...optimistic }, ...detail.stream],
  };
};

// Replace the optimistic row (matched by tempId) with the
// server-authoritative message once the POST returns.
const replaceOptimistic = (
  detail: ApiNudgeConversationDetail | null,
  tempId: string,
  message: ApiNudgeMessageJSON,
): ApiNudgeConversationDetail => {
  if (!detail) throw new Error('replaceOptimistic called without detail');
  return {
    ...detail,
    conversation: {
      ...detail.conversation,
      last_activity_at: message.created_at,
      preview: message.body ?? (message.media.length > 0 ? '📷 media' : ''),
      latest_kind: 'message',
    },
    stream: detail.stream.map((item) =>
      item.kind === 'message' && item.id === tempId
        ? { kind: 'message', ...message }
        : item,
    ),
  };
};

// Mark the optimistic row as failed so the retry affordance appears.
// The row stays in place — user can retry or dismiss.
const markOptimisticFailed = (
  detail: ApiNudgeConversationDetail | null,
  tempId: string,
): ApiNudgeConversationDetail => {
  if (!detail) throw new Error('markOptimisticFailed called without detail');
  return {
    ...detail,
    stream: detail.stream.map((item) =>
      item.kind === 'message' && item.id === tempId
        ? { ...item, sending: false, failed: true }
        : item,
    ),
  };
};

const removeOptimistic = (
  detail: ApiNudgeConversationDetail | null,
  tempId: string,
): ApiNudgeConversationDetail => {
  if (!detail) throw new Error('removeOptimistic called without detail');
  return {
    ...detail,
    stream: detail.stream.filter(
      (item) => !(item.kind === 'message' && item.id === tempId),
    ),
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
  const history = useHistory();
  const streamRef = useRef<HTMLDivElement>(null);
  // A ref keeps the latest detail visible to stream handlers without
  // re-subscribing every re-render.
  const detailRef = useRef<ApiNudgeConversationDetail | null>(detail);
  useEffect(() => {
    detailRef.current = detail;
  }, [detail]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  // `hasMore` starts true and flips false the first time a page comes
  // back short of STREAM_LIMIT. Reset on conversationId change so a
  // different chat gets a fresh chance.
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    setHasMore(true);
    setLoadingOlder(false);
  }, [conversationId]);

  // Pin scroll to the newest message on open + on new arrivals. Direct
  // scrollTop write is more reliable across engines than scrollIntoView
  // or column-reverse — both of which left the stream landing at the
  // top on shadow. useLayoutEffect fires pre-paint so no flash of the
  // head. Keyed on conversationId (fresh open) + stream length (new
  // message arrived).
  useLayoutEffect(() => {
    const el = streamRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conversationId, detail?.stream.length]);

  // Real-time streaming — subscribe to nudges:conversation events for
  // the open conversation and fold updates into the local detail. The
  // handlers are stable (they read `detailRef` for the current stream)
  // so the effect doesn't re-subscribe on every render.
  useNudgesConversationStream(conversationId, {
    onMessageCreated: (msg) => {
      const current = detailRef.current;
      if (!current) return;
      // Drop echoes for messages already in the stream (self-send lands
      // via the optimistic path first).
      if (
        current.stream.some(
          (item) => item.kind === 'message' && item.id === msg.id,
        )
      ) {
        return;
      }
      onMessageSent({
        ...current,
        stream: [{ kind: 'message', ...msg }, ...current.stream],
        conversation: {
          ...current.conversation,
          last_activity_at: msg.created_at,
          preview:
            msg.body ??
            (msg.media.length > 0 ? '📷 media' : current.conversation.preview),
          latest_kind: 'message',
        },
      });
    },
    onMessageUpdated: (msg) => {
      const current = detailRef.current;
      if (!current) return;
      onMessageSent({
        ...current,
        stream: current.stream.map((item) =>
          item.kind === 'message' && item.id === msg.id
            ? { kind: 'message', ...msg }
            : item,
        ),
      });
    },
    onMessageDeleted: (msg) => {
      const current = detailRef.current;
      if (!current) return;
      // Tombstoned rows come through as an update flavour (payload
      // has `deleted: true`); treat as an update so the row stays but
      // the serializer's redaction applies.
      onMessageSent({
        ...current,
        stream: current.stream.map((item) =>
          item.kind === 'message' && item.id === msg.id
            ? { kind: 'message', ...msg }
            : item,
        ),
      });
    },
    onEventCreated: (event) => {
      const current = detailRef.current;
      if (!current) return;
      if (
        current.stream.some(
          (item) => item.kind === 'event' && item.id === event.id,
        )
      ) {
        return;
      }
      onMessageSent({
        ...current,
        stream: [{ kind: 'event', ...event }, ...current.stream],
        conversation: {
          ...current.conversation,
          last_activity_at: event.created_at,
          latest_kind: 'event',
        },
      });
    },
    onRead: (payload) => {
      const current = detailRef.current;
      if (!current) return;
      // Skip our own reads; we already know them.
      if (me && payload.reader_account_id === me) return;

      if (current.conversation.kind === 'mate') {
        onMessageSent({
          ...current,
          conversation: {
            ...current.conversation,
            other_last_read_message_id: payload.last_read_message_id,
          },
        });
        return;
      }

      // Krew: upsert the reader's pointer in `krew.read_pointers`.
      const krew = current.conversation.krew;
      if (!krew || !payload.last_read_message_id) return;
      const nextPointers = krew.read_pointers.filter(
        (p) => p.account_id !== payload.reader_account_id,
      );
      nextPointers.push({
        account_id: payload.reader_account_id,
        last_read_message_id: payload.last_read_message_id,
      });
      onMessageSent({
        ...current,
        conversation: {
          ...current.conversation,
          krew: { ...krew, read_pointers: nextPointers },
        },
      });
    },
  });

  const handleLoadOlder = useCallback(() => {
    if (!detail || loadingOlder || !hasMore) return;
    const oldest = detail.stream[detail.stream.length - 1];
    if (!oldest) return;
    setLoadingOlder(true);
    void (async () => {
      try {
        const { stream } = await apiGetNudgeConversationPage(
          conversationId,
          oldest.created_at,
        );
        if (stream.length === 0) {
          setHasMore(false);
        } else {
          // Backend caps each page at STREAM_LIMIT (100). A short page
          // means we've reached the tail.
          if (stream.length < 100) setHasMore(false);
          onMessageSent({
            ...detail,
            stream: [...detail.stream, ...stream],
          });
        }
      } catch {
        // Silent — the button stays clickable so the user can retry.
      } finally {
        setLoadingOlder(false);
      }
    })();
  }, [conversationId, detail, loadingOlder, hasMore, onMessageSent]);

  // On open, mark read.
  useEffect(() => {
    if (!detail || detail.conversation.unread_count === 0) return;
    void apiMarkNudgeConversationRead(conversationId);
  }, [conversationId, detail]);

  // Truly optimistic: prepend a client-authored row with a tempId
  // before the POST, then reconcile with the server response (replace
  // on success, mark failed on rejection). Composer clears instantly;
  // the bubble shows a subtle "sending…" tick until acknowledged.
  const handleSend = useCallback(
    async (body: string, mediaAttachmentIds: string[]) => {
      const trimmed = body.trim();
      if (!trimmed && mediaAttachmentIds.length === 0) return;
      const tempId = `tmp-${crypto.randomUUID()}`;

      onMessageSent(prependOptimistic(detail, tempId, trimmed));

      try {
        const created = await apiSendNudgeMessage(
          conversationId,
          trimmed,
          mediaAttachmentIds,
        );
        onMessageSent(replaceOptimistic(detail, tempId, created));
      } catch {
        onMessageSent(markOptimisticFailed(detail, tempId));
      }
    },
    [conversationId, detail, onMessageSent],
  );

  const handleRetry = useCallback(
    async (failed: ApiNudgeMessageJSON) => {
      const tempId = failed.id;
      // Reset the row to sending-state.
      onMessageSent(
        applyUpdatedMessage(detail, {
          ...failed,
          sending: true,
          failed: false,
        }),
      );
      try {
        const created = await apiSendNudgeMessage(
          conversationId,
          failed.body ?? '',
          [],
        );
        onMessageSent(replaceOptimistic(detail, tempId, created));
      } catch {
        onMessageSent(markOptimisticFailed(detail, tempId));
      }
    },
    [conversationId, detail, onMessageSent],
  );

  const handleDismissFailed = useCallback(
    (failed: ApiNudgeMessageJSON) => {
      onMessageSent(removeOptimistic(detail, failed.id));
    },
    [detail, onMessageSent],
  );

  const handleToggleMute = useCallback(() => {
    if (!detail) return;
    const muted = detail.conversation.muted;
    void (async () => {
      const updated = muted
        ? await apiUnmuteNudgeConversation(conversationId)
        : await apiMuteNudgeConversation(conversationId);
      onMessageSent({
        ...detail,
        conversation: { ...detail.conversation, ...updated },
      });
    })();
  }, [conversationId, detail, onMessageSent]);

  const handleLeaveKrew = useCallback(() => {
    if (
      !window.confirm(
        intl.formatMessage({
          id: 'nudges.confirm_leave_krew',
          defaultMessage: 'Leave this Krew? You will also leave the group.',
        }),
      )
    ) {
      return;
    }
    void (async () => {
      await apiLeaveNudgeConversation(conversationId);
      history.push('/nudges');
    })();
  }, [conversationId, history, intl]);

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

  // Stream is delivered newest-first; render oldest-first in DOM so a
  // new message lands at the bottom of the flow (visually + in the
  // scroll container). Then run through `aggregateStream` to collapse
  // consecutive passive nudges per brief §Open decisions (resolved
  // 2026-07-22).
  const oldestFirst = aggregateStream(
    [...detail.stream].reverse(),
    detail.conversation.kind,
  );

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
            <button
              type='button'
              className='nudges-conversation__mute'
              onClick={handleToggleMute}
              aria-pressed={detail.conversation.muted}
            >
              {detail.conversation.muted ? (
                <FormattedMessage
                  id='nudges.krew.unmute'
                  defaultMessage='Unmute'
                />
              ) : (
                <FormattedMessage id='nudges.krew.mute' defaultMessage='Mute' />
              )}
            </button>
            <button
              type='button'
              className='nudges-conversation__leave'
              onClick={handleLeaveKrew}
            >
              <FormattedMessage id='nudges.krew.leave' defaultMessage='Leave' />
            </button>
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

      <div className='nudges-conversation__stream' ref={streamRef}>
        {hasMore && detail.stream.length > 0 && (
          <button
            type='button'
            className='nudges-conversation__load-older'
            onClick={handleLoadOlder}
            disabled={loadingOlder}
          >
            {loadingOlder ? (
              <FormattedMessage
                id='nudges.loading_older'
                defaultMessage='Loading…'
              />
            ) : (
              <FormattedMessage
                id='nudges.load_older'
                defaultMessage='Load older messages'
              />
            )}
          </button>
        )}
        {oldestFirst.map((item, index) => {
          const previous = index > 0 ? oldestFirst[index - 1] : null;
          const showDay =
            !previous || !sameDay(previous.created_at, item.created_at);
          return (
            <React.Fragment key={`${item.kind}-${item.id}`}>
              {showDay && <DaySeparator timestamp={item.created_at} />}
              {item.kind === 'aggregate' ? (
                <AggregatedEventItem
                  item={item}
                  conversationKind={detail.conversation.kind}
                />
              ) : (
                <StreamItem
                  item={item}
                  conversationKind={detail.conversation.kind}
                  otherLastReadMessageId={
                    detail.conversation.other_last_read_message_id
                  }
                  krewReadPointers={detail.conversation.krew?.read_pointers}
                  krewMemberCount={detail.conversation.krew?.member_count}
                  onReact={handleReact}
                  onUnreact={handleUnreact}
                  onDelete={handleDelete}
                  onRetry={handleRetry}
                  onDismissFailed={handleDismissFailed}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <Composer onSend={handleSend} conversationId={conversationId} />
    </div>
  );
};
