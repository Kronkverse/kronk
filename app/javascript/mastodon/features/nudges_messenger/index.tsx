import { useEffect, useState, useCallback, useMemo, useRef } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useParams, useHistory, useLocation } from 'react-router-dom';

import { showAlertForError } from 'mastodon/actions/alerts';
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
import { BackToKorner } from 'mastodon/components/back_to_korner';
import { SpaceHeader } from 'mastodon/components/space_header';
import { useSpaceHeaderOverride } from 'mastodon/components/space_header_override';
import { Stage } from 'mastodon/components/stage';
import {
  selectNudgesAlertCount,
  selectUnreadNudgeMessagesCount,
} from 'mastodon/selectors/notifications';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

import { ConversationList } from './conversation_list';
import { ConversationView } from './conversation_view';
import { NotificationsFace } from './notifications_face';
import { useFillViewport } from './use_fill_viewport';
import { useNudgesAccountStream } from './use_nudges_account_stream';
import type { NudgesArrival } from './use_nudges_account_stream';

// Nudges — one space (Tal, 2026-11-23: "melded into one space, with
// notifications forming one chat space, persistently at the top of the
// list … so its not swapping a page to get to chats but just changing
// view").
//
//   /nudges                  The list. On a wide screen, Notifications is
//                            open beside it; on a phone the list is the page.
//   /nudges/notifications    Notifications open: the pinned first row.
//   /nudges/:conversationId  That chat open.
//   /nudges/with/:accountId  Opens (or starts) the Mate chat with that
//                            person, then lands on the URL above.
//   /nudges/messages         The list, as /nudges (older links).
//
// The list of chats always leads with Notifications, then the Mates and
// Krews. On a wide screen the list sits on the left and whatever is
// open shows on the right: choosing another changes the view in place. On
// a phone they are two pages: the list, and what's open, with the way back
// to the list where the title was.
//
// Spec: docs/spaces/nudges.md (Nudges spec) § Surfaces.

const messages = defineMessages({
  title: { id: 'nudges.title', defaultMessage: 'Nudges' },
  notifications: {
    id: 'nudges.face.notifications',
    defaultMessage: 'Notifications',
  },
  back: { id: 'nudges.back_to_chats', defaultMessage: 'Chats' },
  tagline: {
    id: 'nudges.tagline',
    defaultMessage: 'Notifications, Mates and Krews',
  },
});

const HOME_PATH = '/nudges';
const NOTIFICATIONS_PATH = '/nudges/notifications';

// Wide enough for the list and the open pane side by side. Matches the
// stylesheet's phone breakpoint (`width <= 889px`).
const WIDE_QUERY = '(min-width: 890px)';

const useWide = () => {
  const [wide, setWide] = useState(() => window.matchMedia(WIDE_QUERY).matches);
  useEffect(() => {
    const query = window.matchMedia(WIDE_QUERY);
    const onChange = () => {
      setWide(query.matches);
    };
    query.addEventListener('change', onChange);
    return () => {
      query.removeEventListener('change', onChange);
    };
  }, []);
  return wide;
};

// The title row, in the Frame's header slot as every space has one. The
// Frame leaves a core space's header to the space, so Nudges hands it its
// own: the manifest's name. Rendered inside `<Stage>`, where the slot's
// provider lives. The stylesheet takes the row away on a phone while
// something is open.
const NudgesHeader: React.FC = () => {
  const intl = useIntl();
  const node = useMemo(
    () => (
      <SpaceHeader
        slug='nudges'
        tagline={intl.formatMessage(messages.tagline)}
      />
    ),
    [intl],
  );
  useSpaceHeaderOverride(node);
  return null;
};

// The list and the open chat. Its height is measured, not inherited: see
// `useFillViewport`.
const MessengerFrame: React.FC<{
  paneOpen: boolean;
  children: React.ReactNode;
}> = ({ paneOpen, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  useFillViewport(ref);

  return (
    <div
      ref={ref}
      className={`nudges-messenger ${paneOpen ? 'nudges-messenger--pane-open' : ''}`}
    >
      {children}
    </div>
  );
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

  const wide = useWide();
  // What the pane shows: a chat, Notifications, or (on a phone, at
  // /nudges) nothing, because the list is the page.
  const atHome =
    location.pathname === HOME_PATH || location.pathname === '/nudges/messages';
  const showNotifications =
    !conversationId &&
    !accountId &&
    (location.pathname === NOTIFICATIONS_PATH || (atHome && wide));
  const paneOpen = !!conversationId || location.pathname === NOTIFICATIONS_PATH;

  // The pinned Notifications row counts what's waiting in it: everything
  // behind the pillar that isn't an unread chat message.
  const alertCount = useAppSelector(selectNudgesAlertCount);
  const unreadMessages = useAppSelector(selectUnreadNudgeMessagesCount);
  const notificationsWaiting = Math.max(0, alertCount - unreadMessages);

  const handleOpenNotifications = useCallback(() => {
    if (location.pathname !== NOTIFICATIONS_PATH)
      history.push(NOTIFICATIONS_PATH);
  }, [history, location.pathname]);

  // `/nudges/with/:accountId` — resolve the person to their Mate chat and
  // swap the URL for the chat's own. Whatever rode along in history state
  // (a post being shared into the chat) is carried over.
  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    const open = async () => {
      try {
        // From a Wachuneed listing, the listing rides along: its "who can
        // message you" may take in someone who is not a Mate.
        const listingId = (
          location.state as { wachuneedListingId?: string } | undefined
        )?.wachuneedListingId;
        const conversation = await apiOpenMateConversation(
          accountId,
          listingId,
        );
        if (!cancelled)
          history.replace(`/nudges/${conversation.id}`, location.state);
      } catch {
        // Not Mates, or no such account: there is no chat to open.
        if (!cancelled) history.replace(HOME_PATH);
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
  // open. A notification is Notifications' own business; its row's count
  // comes from the store.
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
      void apiAcceptNudgeInvite(id)
        .then(() => {
          void loadConversations();
          handleOpenConversation(id);
        })
        .catch((error: unknown) => {
          dispatch(showAlertForError(error));
        });
    },
    [loadConversations, handleOpenConversation, dispatch],
  );

  const handleDeclineInvite = useCallback(
    (id: string) => {
      void apiDeclineNudgeInvite(id)
        .then(() => {
          setConversations((prev) => prev.filter((c) => c.id !== id));
        })
        .catch((error: unknown) => {
          dispatch(showAlertForError(error));
        });
    },
    [dispatch],
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

      <NudgesHeader />

      <div className='stage-fill'>
        <MessengerFrame paneOpen={paneOpen}>
          <aside className='nudges-messenger__sidebar'>
            <ConversationList
              conversations={sortedConversations}
              loading={conversationsLoading}
              activeId={conversationId ?? null}
              notificationsActive={showNotifications}
              notificationsCount={notificationsWaiting}
              onOpenNotifications={handleOpenNotifications}
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
              showNotifications && (
                <div className='nudges-messenger__notifications'>
                  <header className='nudges-conversation__head'>
                    <BackToKorner
                      href={HOME_PATH}
                      label={intl.formatMessage(messages.back)}
                      className='nudges-conversation__to-chats'
                    />
                    <span className='nudges-conversation__name'>
                      <FormattedMessage {...messages.notifications} />
                    </span>
                  </header>
                  <NotificationsFace />
                </div>
              )
            )}
          </section>
        </MessengerFrame>
      </div>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default NudgesMessenger;
