import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, FormattedMessage } from 'react-intl';

import { Link } from 'react-router-dom';

import { setNudgesUnread } from 'mastodon/actions/nudges';
import {
  apiGetNudgeConversation,
  apiListNudgeConversations,
} from 'mastodon/api/nudges_conversations';
import type { ApiNudgeConversationDetail } from 'mastodon/api_types/nudges_conversations';
import { ConversationView } from 'mastodon/features/nudges_messenger/conversation_view';
import { useAppDispatch } from 'mastodon/store';

const messages = defineMessages({
  chat: { id: 'krew.detail.chat', defaultMessage: 'Chat' },
  openInNudges: {
    id: 'krew.chat.open_in_nudges',
    defaultMessage: 'Open in Nudges',
  },
});

// The Krew's chat on its page, below the spaces (decisions.md, 2026-10-18):
// the same chat as in Nudges, read and written here. It is marked read once
// it has been on screen, not as soon as the page opens.
export const KrewChat: React.FC<{
  conversationId: string;
  onRead: () => void;
}> = ({ conversationId, onRead }) => {
  const dispatch = useAppDispatch();
  const ref = useRef<HTMLElement>(null);
  const [detail, setDetail] = useState<ApiNudgeConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDetail(null);
    setSeen(false);
    apiGetNudgeConversation(conversationId)
      .then((next) => {
        if (!cancelled) setDetail(next);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setSeen(true);
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [seen]);

  // After a mark-read: the chat's summary, the unread line above, and the
  // Nudges badge, which counts this chat too.
  const handleUpdate = useCallback(
    (next: ApiNudgeConversationDetail) => {
      setDetail((prev) =>
        prev && prev.conversation.id === next.conversation.id
          ? { ...prev, conversation: next.conversation }
          : prev,
      );
      if (next.conversation.unread_count === 0) onRead();
      apiListNudgeConversations()
        .then((list) => {
          dispatch(
            setNudgesUnread(list.reduce((sum, c) => sum + c.unread_count, 0)),
          );
        })
        .catch(() => {
          // The badge catches up on the next stream event.
        });
    },
    [dispatch, onRead],
  );

  return (
    <section
      ref={ref}
      id='krew-chat'
      className='krew-detail__section krew-detail__chat'
    >
      <h3 className='korner-section-heading'>
        <FormattedMessage {...messages.chat} />
        <Link
          to={`/nudges/${conversationId}`}
          className='krew-detail__chat-open'
        >
          <FormattedMessage {...messages.openInNudges} />
        </Link>
      </h3>
      <div className='krew-detail__chat-frame'>
        <ConversationView
          embedded
          markRead={seen}
          conversationId={conversationId}
          detail={detail}
          loading={loading}
          onMessageSent={setDetail}
          onConversationUpdate={handleUpdate}
        />
      </div>
    </section>
  );
};
