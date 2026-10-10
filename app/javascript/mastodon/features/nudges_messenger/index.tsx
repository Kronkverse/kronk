import { useEffect, useState, useCallback, useMemo } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useParams, useHistory, useLocation } from 'react-router-dom';

import { setNudgesUnread } from 'mastodon/actions/nudges';
import {
  apiListNudgeConversations,
  apiGetNudgeConversation,
  apiAcceptNudgeInvite,
  apiDeclineNudgeInvite,
  apiOpenMateConversation,
} from 'mastodon/api/nudges_conversations';
import type {
  ApiNudgeConversationJSON,
  ApiNudgeConversationDetail,
} from 'mastodon/api_types/nudges_conversations';
import { FeedDrum } from 'mastodon/components/feed_drum';
import { ScopeTitle } from 'mastodon/components/scope_title';
import type { ScopeTitleFace } from 'mastodon/components/scope_title';
import { useSpaceHeaderOverride } from 'mastodon/components/space_header_override';
import { Stage } from 'mastodon/components/stage';
import {
  selectUnreadNudgeMessagesCount,
  selectUnseenNudgeNotificationsCount,
} from 'mastodon/selectors/notifications';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

import { ConversationList } from './conversation_list';
import { ConversationView } from './conversation_view';
import { EmptyState } from './empty_state';
import { NotificationsFace } from './notifications_face';
import { useNudgesAccountStream } from './use_nudges_account_stream';
import type { NudgesArrival } from './use_nudges_account_stream';

// Nudges — two faces on one barrel.
//
//   /nudges                  Notifications: what has happened that involves
//                            you. Where you land.
//   /nudges/messages         Messages: the messenger, with no chat open.
//   /nudges/:conversationId  Messages, with that chat open.
//   /nudges/with/:accountId  Opens (or starts) the Mate chat with that
//                            person, then lands on the URL above.
//
// A sideways swipe turns between the two faces (`<FeedDrum>`, the same
// quarter-turn as /home and Kalendar). Without touch, the Notifications
// face turns from its title (`<ScopeTitle>`), and the Messages face from
// the button at the top of the chat strip.
//
// Spec: docs/spaces/nudges.md (Nudges spec) § Surfaces.

const messages = defineMessages({
  title: { id: 'nudges.title', defaultMessage: 'Nudges' },
  notifications: {
    id: 'nudges.face.notifications',
    defaultMessage: 'Notifications',
  },
  notificationsTagline: {
    id: 'nudges.face.notifications.tagline',
    defaultMessage: "What's new for you",
  },
  messages: { id: 'nudges.face.messages', defaultMessage: 'Messages' },
  messagesTagline: {
    id: 'nudges.face.messages.tagline',
    defaultMessage: 'Your Mates and Krews',
  },
  rotatorAria: {
    id: 'nudges.face.rotator_aria',
    defaultMessage: 'Switch between notifications and messages',
  },
});

type Face = 'notifications' | 'messages';
const FACES: Face[] = ['notifications', 'messages'];
const NOTIFICATIONS_PATH = '/nudges';
const MESSAGES_PATH = '/nudges/messages';

// The Messages URL the viewer was last on, so turning away to Notifications
// and back returns to the chat they had open and not to an empty pane.
// Module-level: it should outlive the component, but not the page load.
let lastMessagesPath = MESSAGES_PATH;

// The Notifications face wears the standard rotating title in the Frame's
// header slot. Rendered inside `<Stage>`, which is where the slot's provider
// lives. The Messages face has no header row at all (the messenger keeps
// that height for the conversation), so this is not mounted there.
const NotificationsHeader: React.FC<{ onChange: (key: string) => void }> = ({
  onChange,
}) => {
  const intl = useIntl();

  const node = useMemo(() => {
    const faces: ScopeTitleFace[] = [
      {
        key: 'notifications',
        label: intl.formatMessage(messages.notifications),
        desc: intl.formatMessage(messages.notificationsTagline),
      },
      {
        key: 'messages',
        label: intl.formatMessage(messages.messages),
        desc: intl.formatMessage(messages.messagesTagline),
      },
    ];
    return (
      <ScopeTitle
        faces={faces}
        value='notifications'
        onChange={onChange}
        ariaLabel={intl.formatMessage(messages.rotatorAria)}
        frameHeader
      />
    );
  }, [intl, onChange]);
  useSpaceHeaderOverride(node);

  return null;
};

interface RouteParams {
  conversationId?: string;
  accountId?: string;
}

const NudgesMessenger: React.FC = () => {
  const intl = useIntl();
  const history = useHistory();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { conversationId, accountId } = useParams<RouteParams>();

  const face: Face =
    location.pathname === NOTIFICATIONS_PATH ? 'notifications' : 'messages';
  if (face === 'messages' && !accountId) lastMessagesPath = location.pathname;

  const unreadMessages = useAppSelector(selectUnreadNudgeMessagesCount);
  const unseenNotifications = useAppSelector(
    selectUnseenNudgeNotificationsCount,
  );

  const handleFaceChange = useCallback(
    (next: string) => {
      const target =
        next === 'notifications' ? NOTIFICATIONS_PATH : lastMessagesPath;
      if (target !== location.pathname) history.push(target);
    },
    [history, location.pathname],
  );

  // `/nudges/with/:accountId` — resolve the person to their Mate chat and
  // swap the URL for the chat's own. Whatever rode along in history state
  // (a post being shared into the chat) is carried over.
  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    const open = async () => {
      try {
        const conversation = await apiOpenMateConversation(accountId);
        if (!cancelled)
          history.replace(`/nudges/${conversation.id}`, location.state);
      } catch {
        // Not Mates, or no such account: there is no chat to open.
        if (!cancelled) history.replace(MESSAGES_PATH);
      }
    };
    void open();
    return () => {
      cancelled = true;
    };
    // Keyed on the account alone; `location.state` is read once, as it was
    // when the link was followed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, history]);

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

  // Live: a new message or chat line in any of the viewer's conversations
  // refreshes the list + reseeds unread — even a conversation not currently
  // open. A notification is the Notifications face's business, not this
  // list's.
  const handleStreamArrival = useCallback(
    (arrival: NudgesArrival) => {
      if (arrival === 'chat') void loadConversations();
    },
    [loadConversations],
  );
  useNudgesAccountStream(handleStreamArrival);

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

  // The chat list only carries chats that have a message in them, so a
  // chat just opened from the Mate picker is not in a fresh load of it.
  // Keep the open one in the strip regardless, so it doesn't drop out from
  // under the viewer while they write the first message.
  const sortedConversations = useMemo(() => {
    const open = activeDetail?.conversation;
    const all =
      open && !conversations.some((c) => c.id === open.id)
        ? [open, ...conversations]
        : conversations;
    return [...all].sort((a, b) =>
      (b.last_activity_at ?? '').localeCompare(a.last_activity_at ?? ''),
    );
  }, [conversations, activeDetail]);

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      {face === 'notifications' && (
        <NotificationsHeader onChange={handleFaceChange} />
      )}

      <div className='stage-fill'>
        <FeedDrum reach={face} order={FACES} onScopeChange={handleFaceChange}>
          {face === 'notifications' ? (
            <NotificationsFace
              unreadMessages={unreadMessages}
              messagesPath={lastMessagesPath}
            />
          ) : (
            <div className='nudges-messenger'>
              <aside className='nudges-messenger__sidebar'>
                <ConversationList
                  conversations={sortedConversations}
                  loading={conversationsLoading}
                  activeId={conversationId ?? null}
                  unseenNotifications={unseenNotifications}
                  onOpen={handleOpenConversation}
                  onNewConversation={handleNewConversation}
                  onAccept={handleAcceptInvite}
                  onDecline={handleDeclineInvite}
                />
              </aside>

              <section className='nudges-messenger__pane'>
                {conversationId ? (
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
          )}
        </FeedDrum>
      </div>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default NudgesMessenger;
