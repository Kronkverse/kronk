import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import ChatIcon from '@/material-icons/400-24px/chat.svg?react';
import ChevronRightIcon from '@/material-icons/400-24px/chevron_right.svg?react';
import { submitMarkers } from 'mastodon/actions/markers';
import { markNotificationsAsRead } from 'mastodon/actions/notification_groups';
import { setNudgesUnseenNotifications } from 'mastodon/actions/nudges';
import {
  apiListNudgeNotifications,
  apiMarkNudgeNotificationsSeen,
} from 'mastodon/api/nudges_notifications';
import type { ApiNudgeNotificationJSON } from 'mastodon/api_types/nudges_notifications';
import { compareId } from 'mastodon/compare_id';
import { EmptyState } from 'mastodon/components/empty_state';
import { Icon } from 'mastodon/components/icon';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LoadingState } from 'mastodon/components/loading_state';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

import { DaySeparator } from './day_separator';
import { isKronkSystemType } from './kronk_system';
import type { KronkSystemGroup } from './kronk_system';
import { NotificationRow } from './notification_row';
import { SystemNoticeRow } from './system_notice_row';
import { useNudgesAccountStream } from './use_nudges_account_stream';
import type { NudgesArrival } from './use_nudges_account_stream';

// The Notifications face of Nudges: everything addressed to you, newest
// first, in one list. Spec: docs/spaces/nudges.md (Nudges spec)
// § Notifications list.
//
// Opening the face is what marks things seen — there is no "mark all read"
// to press. What was new when you arrived stays marked as new for the rest
// of the visit, so you can still tell which rows those were.

const messages = defineMessages({
  loading: {
    id: 'nudges.notifications.loading',
    defaultMessage: 'Fetching your notifications',
  },
  emptyTitle: {
    id: 'nudges.notifications.empty.title',
    defaultMessage: 'Nothing here yet',
  },
  emptyBody: {
    id: 'nudges.notifications.empty.body',
    defaultMessage:
      'When someone froths, replies, backs something of yours or asks to be Mates, you will see it here.',
  },
  errorTitle: {
    id: 'nudges.notifications.error.title',
    defaultMessage: "Couldn't load your notifications",
  },
  retry: { id: 'nudges.notifications.retry', defaultMessage: 'Try again' },
  earlier: {
    id: 'nudges.notifications.earlier',
    defaultMessage: 'Show earlier',
  },
  unreadMessages: {
    id: 'nudges.notifications.unread_messages',
    defaultMessage:
      '{count, plural, one {# unread message} other {# unread messages}}',
  },
  listLabel: {
    id: 'nudges.notifications.list_label',
    defaultMessage: 'Notifications',
  },
});

// Cards the user has clicked into stay flagged as "visited" locally, so a
// system notice that still needs a response stays distinct from one already
// followed up. Client-side on purpose: it is UI hygiene, not authoritative
// state — the proposal's own lifecycle is the record.
const VISITED_KEY = 'kronk.nudges.system.visited';

const readVisited = (): Set<string> => {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(VISITED_KEY) ?? '[]',
    );
    return Array.isArray(parsed)
      ? new Set(parsed.filter((v): v is string => typeof v === 'string'))
      : new Set();
  } catch {
    return new Set();
  }
};

const writeVisited = (set: Set<string>): void => {
  try {
    localStorage.setItem(VISITED_KEY, JSON.stringify([...set]));
  } catch {
    // Storage full or blocked — the flag just won't persist.
  }
};

type Entry =
  | { kind: 'event'; key: string; at: string; item: ApiNudgeNotificationJSON }
  | { kind: 'system'; key: string; at: string; group: KronkSystemGroup };

const sameDay = (a: string, b: string) =>
  new Date(a).toDateString() === new Date(b).toDateString();

interface Props {
  unreadMessages: number;
  // Where the Messages face is right now (the chat list, or the chat that
  // was open when the viewer turned away from it).
  messagesPath: string;
}

export const NotificationsFace: React.FC<Props> = ({
  unreadMessages,
  messagesPath,
}) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();

  const [items, setItems] = useState<ApiNudgeNotificationJSON[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [loadingMore, setLoadingMore] = useState(false);

  // Ids that were unseen when they first reached this visit. Kept so a
  // refresh (which comes back with them marked seen) doesn't wipe the cue.
  const freshIds = useRef(new Set<string>());
  // The newest `as_of` not yet acknowledged, waiting for the tab to be
  // visible before it is sent.
  const pendingSeen = useRef<string | null>(null);

  const acknowledge = useCallback(async () => {
    const upTo = pendingSeen.current;
    if (!upTo || document.visibilityState !== 'visible') return;
    pendingSeen.current = null;
    try {
      const { unseen_count: unseen } =
        await apiMarkNudgeNotificationsSeen(upTo);
      dispatch(setNudgesUnseenNotifications(unseen));
    } catch {
      // Left unseen on the server; the next load tries again.
      pendingSeen.current = upTo;
    }
  }, [dispatch]);

  const load = useCallback(async () => {
    try {
      const page = await apiListNudgeNotifications();
      page.notifications.forEach((item) => {
        if (!item.seen) freshIds.current.add(item.id);
      });
      setItems(page.notifications);
      setNextBefore(page.next_before);
      setStatus('ready');
      dispatch(setNudgesUnseenNotifications(page.unseen_count));
      if (page.unseen_count > 0) {
        pendingSeen.current = page.as_of;
        void acknowledge();
      }
    } catch {
      setStatus((prev) => (prev === 'ready' ? prev : 'error'));
    }
  }, [dispatch, acknowledge]);

  useEffect(() => {
    void load();
  }, [load]);

  // A notification that arrives while the face is open joins the top.
  const handleArrival = useCallback(
    (arrival: NudgesArrival) => {
      if (arrival === 'notification') void load();
    },
    [load],
  );
  useNudgesAccountStream(handleArrival);

  // If the tab was in the background when things loaded, they are marked
  // seen once it is actually looked at.
  useEffect(() => {
    const onVisible = () => {
      void acknowledge();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [acknowledge]);

  const handleRetry = useCallback(() => {
    setStatus('loading');
    void load();
  }, [load]);

  const handleEarlier = useCallback(() => {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    void (async () => {
      try {
        const page = await apiListNudgeNotifications(nextBefore);
        setItems((prev) => {
          const known = new Set(prev.map((item) => item.id));
          return [
            ...prev,
            ...page.notifications.filter((item) => !known.has(item.id)),
          ];
        });
        setNextBefore(page.next_before);
      } catch {
        // Leave the button in place so it can be pressed again.
      } finally {
        setLoadingMore(false);
      }
    })();
  }, [nextBefore, loadingMore]);

  // ── System notices (classic Notification store) ──────────────────
  const systemGroups = useAppSelector((state) =>
    [
      ...state.notificationGroups.groups,
      ...state.notificationGroups.pendingGroups,
    ].filter((g): g is KronkSystemGroup => isKronkSystemType(g.type)),
  );

  // The read marker as it stood on arrival, before this visit moves it —
  // the same "new when you arrived" rule the event rows follow.
  const arrivalMarker = useRef(
    useAppSelector((state) => state.notificationGroups.readMarkerId),
  );

  useEffect(() => {
    dispatch(markNotificationsAsRead());
    void dispatch(submitMarkers({ immediate: true }));
  }, [dispatch, systemGroups.length]);

  const [visited, setVisited] = useState<Set<string>>(readVisited);
  const handleVisit = useCallback((proposalId: string) => {
    setVisited((prev) => {
      if (prev.has(proposalId)) return prev;
      const next = new Set(prev);
      next.add(proposalId);
      writeVisited(next);
      return next;
    });
  }, []);

  const entries = useMemo(() => {
    const merged: Entry[] = items.map((item) => ({
      kind: 'event',
      key: `event-${item.id}`,
      at: item.created_at,
      item,
    }));

    // While there are earlier notifications still to load, hold back the
    // system notices older than the oldest row on screen. They slot in at
    // the right place once that stretch is loaded.
    const oldest = nextBefore ? items[items.length - 1]?.created_at : null;
    systemGroups.forEach((group) => {
      const at = group.latest_page_notification_at;
      if (oldest && at < oldest) return;
      merged.push({
        kind: 'system',
        key: `system-${group.group_key}`,
        at,
        group,
      });
    });

    return merged.sort((a, b) => b.at.localeCompare(a.at));
  }, [items, systemGroups, nextBefore]);

  const isFreshGroup = (group: KronkSystemGroup) =>
    !!group.page_max_id &&
    compareId(group.page_max_id, arrivalMarker.current) > 0;

  return (
    <div className='stage-column'>
      <div className='stage-column__inner'>
        {/* One surface for the whole list, so it reads on the sky in either
            theme. */}
        <div className='nudges-notifications'>
          {unreadMessages > 0 && (
            <Link to={messagesPath} className='nudges-notifications__messages'>
              <Icon id='chat' icon={ChatIcon} />
              <span className='nudges-notifications__messages-label'>
                {intl.formatMessage(messages.unreadMessages, {
                  count: unreadMessages,
                })}
              </span>
              <Icon id='chevron-right' icon={ChevronRightIcon} />
            </Link>
          )}

          {status === 'loading' && (
            <LoadingState label={intl.formatMessage(messages.loading)} />
          )}

          {status === 'error' && (
            <EmptyState
              title={intl.formatMessage(messages.errorTitle)}
              action={
                <KornerPill
                  label={intl.formatMessage(messages.retry)}
                  onClick={handleRetry}
                />
              }
            />
          )}

          {status === 'ready' && entries.length === 0 && (
            <EmptyState
              title={intl.formatMessage(messages.emptyTitle)}
              body={intl.formatMessage(messages.emptyBody)}
            />
          )}

          {status === 'ready' && entries.length > 0 && (
            <ul
              className='nudges-notifications__list'
              aria-label={intl.formatMessage(messages.listLabel)}
            >
              {entries.map((entry, index) => {
                const previous = entries[index - 1];
                const newDay = !previous || !sameDay(previous.at, entry.at);

                return (
                  <Fragment key={entry.key}>
                    {newDay && (
                      <li className='nudges-notifications__day'>
                        <DaySeparator timestamp={entry.at} />
                      </li>
                    )}
                    {entry.kind === 'event' ? (
                      <NotificationRow
                        item={entry.item}
                        fresh={freshIds.current.has(entry.item.id)}
                      />
                    ) : (
                      <SystemNoticeRow
                        group={entry.group}
                        fresh={isFreshGroup(entry.group)}
                        visited={visited}
                        onVisit={handleVisit}
                      />
                    )}
                  </Fragment>
                );
              })}
            </ul>
          )}

          {status === 'ready' && nextBefore && (
            <div className='nudges-notifications__more'>
              <KornerPill
                label={intl.formatMessage(messages.earlier)}
                onClick={handleEarlier}
                disabled={loadingMore}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
