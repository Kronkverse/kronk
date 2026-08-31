import { useEffect, useState, useCallback, useMemo } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useParams, useHistory } from 'react-router-dom';

import { setNudgesUnread } from 'mastodon/actions/nudges';
import {
  apiListNudgeConversations,
  apiGetNudgeConversation,
  apiAcceptNudgeInvite,
  apiDeclineNudgeInvite,
} from 'mastodon/api/nudges_conversations';
import type {
  ApiNudgeConversationJSON,
  ApiNudgeConversationDetail,
} from 'mastodon/api_types/nudges_conversations';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';
import { useAppDispatch } from 'mastodon/store';

import { ConversationList } from './conversation_list';
import { ConversationView } from './conversation_view';
import { EmptyState } from './empty_state';
import { KRONK_CONVERSATION_ID } from './kronk_system';
import { KronkSystemView } from './kronk_system_view';
import { useNudgesAccountStream } from './use_nudges_account_stream';

// Nudges messenger shell — the Signal-shaped surface at /nudges.
// Sidebar (conversation list) on the left, open conversation on the
// right. `/nudges/:conversationId` deep-links a specific conversation
// into the right pane; `/nudges` alone leaves the right pane empty.
//
// Spec: docs/kronk_nudges.md §Surface 2. Prototype:
// kronk-nudges-chat.html (visual source of truth).

const messages = defineMessages({
  title: { id: 'nudges.title', defaultMessage: 'Nudges' },
});

interface RouteParams {
  conversationId?: string;
}

const NudgesMessenger: React.FC<{ multiColumn?: boolean }> = ({
  multiColumn,
}) => {
  const intl = useIntl();
  const history = useHistory();
  const dispatch = useAppDispatch();
  const { conversationId } = useParams<RouteParams>();
  const Icon = useKornerIcon('nudges');

  const [conversations, setConversations] = useState<
    ApiNudgeConversationJSON[]
  >([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [activeDetail, setActiveDetail] =
    useState<ApiNudgeConversationDetail | null>(null);
  const [activeLoading, setActiveLoading] = useState(false);

  // Load the sidebar list + reseed the nudge-native unread badge (Σ of each
  // conversation's unread — messages AND events). Also invoked by the account
  // stream on any live arrival, so both the list and the badge stay current
  // without a reload.
  const loadConversations = useCallback(async () => {
    try {
      const data = await apiListNudgeConversations();
      setConversations(data);
      dispatch(
        setNudgesUnread(data.reduce((sum, c) => sum + c.unread_count, 0)),
      );
    } catch {
      // Empty state is fine — surface a real error UI in a follow-up.
    } finally {
      setConversationsLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  // Live: any new event/message in any of the viewer's conversations refreshes
  // the list + reseeds unread — even a conversation not currently open.
  const handleStreamArrival = useCallback(() => {
    void loadConversations();
  }, [loadConversations]);
  useNudgesAccountStream(handleStreamArrival);

  // Load the active conversation whenever the URL param changes.
  useEffect(() => {
    // The Kronk system conversation is synthetic — it has no
    // Nudges::Conversation to fetch; its view reads the notification store.
    if (!conversationId || conversationId === KRONK_CONVERSATION_ID) {
      setActiveDetail(null);
      return () => {
        /* nothing */
      };
    }
    let cancelled = false;
    setActiveLoading(true);
    const load = async () => {
      try {
        const detail = await apiGetNudgeConversation(conversationId);
        if (!cancelled) setActiveDetail(detail);
      } catch {
        if (!cancelled) setActiveDetail(null);
      } finally {
        if (!cancelled) setActiveLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const handleOpenConversation = useCallback(
    (id: string) => {
      history.push(`/nudges/${id}`);
    },
    [history],
  );

  const handleAcceptInvite = useCallback(
    (id: string) => {
      void apiAcceptNudgeInvite(id).then(() => {
        void loadConversations();
        handleOpenConversation(id);
      });
    },
    [loadConversations, handleOpenConversation],
  );

  const handleDeclineInvite = useCallback((id: string) => {
    void apiDeclineNudgeInvite(id).then(() => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
    });
  }, []);

  const handleNewConversation = useCallback(
    (conversation: ApiNudgeConversationJSON) => {
      setConversations((prev) => {
        const others = prev.filter((c) => c.id !== conversation.id);
        return [conversation, ...others];
      });
    },
    [],
  );

  // When a message send lands, prepend it into the local stream and
  // re-sort the sidebar so the row leaps to the top.
  const handleMessageSent = useCallback(
    (detail: ApiNudgeConversationDetail) => {
      setActiveDetail(detail);
      setConversations((prev) => {
        const others = prev.filter((c) => c.id !== detail.conversation.id);
        return [detail.conversation, ...others];
      });
    },
    [],
  );

  // Non-message conversation-summary updates (currently: mark-read
  // acknowledged). Refresh the sidebar row in place and drop the
  // global badge count by whatever this conversation was carrying —
  // without this, the sidebar unread pill + pillar badge stay stuck
  // until the next stream event forces a full reseed.
  const handleConversationUpdate = useCallback(
    (detail: ApiNudgeConversationDetail) => {
      setActiveDetail((prev) =>
        prev && prev.conversation.id === detail.conversation.id
          ? { ...prev, conversation: detail.conversation }
          : prev,
      );
      setConversations((prev) =>
        prev.map((c) =>
          c.id === detail.conversation.id ? detail.conversation : c,
        ),
      );
    },
    [],
  );

  // Keep the global unread-nudges badge in lockstep with the sidebar
  // list. Reseeds on every list change (initial load, sends,
  // mark-read, stream arrivals) with the sum of current unread —
  // never a delta, so it can't drift.
  useEffect(() => {
    dispatch(
      setNudgesUnread(
        conversations.reduce((sum, c) => sum + c.unread_count, 0),
      ),
    );
  }, [conversations, dispatch]);

  const sortedConversations = useMemo(
    () =>
      [...conversations].sort((a, b) =>
        (b.last_activity_at ?? '').localeCompare(a.last_activity_at ?? ''),
      ),
    [conversations],
  );

  return (
    <Column bindToDocument label={intl.formatMessage(messages.title)}>
      <ColumnHeader
        title={intl.formatMessage(messages.title)}
        icon='korner'
        iconComponent={Icon}
        showBackButton
        multiColumn={multiColumn}
      />

      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <div className='nudges-messenger'>
        <aside className='nudges-messenger__sidebar'>
          <ConversationList
            conversations={sortedConversations}
            loading={conversationsLoading}
            activeId={conversationId ?? null}
            onOpen={handleOpenConversation}
            onNewConversation={handleNewConversation}
            onAccept={handleAcceptInvite}
            onDecline={handleDeclineInvite}
          />
        </aside>

        <section className='nudges-messenger__pane'>
          {conversationId === KRONK_CONVERSATION_ID ? (
            <KronkSystemView />
          ) : conversationId ? (
            <ConversationView
              conversationId={conversationId}
              detail={activeDetail}
              loading={activeLoading}
              onMessageSent={handleMessageSent}
              onConversationUpdate={handleConversationUpdate}
            />
          ) : (
            <EmptyState />
          )}
        </section>
      </div>
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export
export default NudgesMessenger;
