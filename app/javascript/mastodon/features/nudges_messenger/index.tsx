import { useEffect, useState, useCallback, useMemo } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useParams, useHistory } from 'react-router-dom';

import {
  apiListNudgeConversations,
  apiGetNudgeConversation,
} from 'mastodon/api/nudges_conversations';
import type {
  ApiNudgeConversationJSON,
  ApiNudgeConversationDetail,
} from 'mastodon/api_types/nudges_conversations';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

import { ConversationList } from './conversation_list';
import { ConversationView } from './conversation_view';
import { EmptyState } from './empty_state';

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
  const { conversationId } = useParams<RouteParams>();
  const Icon = useKornerIcon('nudges');

  const [conversations, setConversations] = useState<
    ApiNudgeConversationJSON[]
  >([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [activeDetail, setActiveDetail] =
    useState<ApiNudgeConversationDetail | null>(null);
  const [activeLoading, setActiveLoading] = useState(false);

  // Load the sidebar list on mount.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await apiListNudgeConversations();
        if (!cancelled) setConversations(data);
      } catch {
        // Empty state is fine — surface a real error UI in a follow-up.
      } finally {
        if (!cancelled) setConversationsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load the active conversation whenever the URL param changes.
  useEffect(() => {
    if (!conversationId) {
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
          />
        </aside>

        <section className='nudges-messenger__pane'>
          {conversationId ? (
            <ConversationView
              conversationId={conversationId}
              detail={activeDetail}
              loading={activeLoading}
              onMessageSent={handleMessageSent}
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
