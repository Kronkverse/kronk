import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { defineMessages, useIntl } from 'react-intl';

import ArrowDownIcon from '@/material-icons/400-24px/arrow_downward.svg?react';
import { submitMarkers } from 'mastodon/actions/markers';
import {
  loadPending,
  markNotificationsAsRead,
} from 'mastodon/actions/notification_groups';
import { setNudgesUnseenNotifications } from 'mastodon/actions/nudges';
import {
  apiListNudgeNotifications,
  apiMarkNudgeNotificationsSeen,
} from 'mastodon/api/nudges_notifications';
import type { ApiNudgeNotificationJSON } from 'mastodon/api_types/nudges_notifications';
import { compareId } from 'mastodon/compare_id';
import { EmptyState } from 'mastodon/components/empty_state';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LoadingState } from 'mastodon/components/loading_state';
import { PushPrompt } from 'mastodon/components/push_prompt';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

import { DaySeparator } from './day_separator';
import { isKronkSystemType } from './kronk_system';
import type { KronkSystemGroup } from './kronk_system';
import { NotificationRow } from './notification_row';
import { SystemNoticeRow } from './system_notice_row';
import { useNudgesAccountStream } from './use_nudges_account_stream';
import type { NudgesArrival } from './use_nudges_account_stream';

// Notifications in Nudges: everything addressed to you, in one list that
// reads like a chat: oldest at the top, the newest at the bottom, where it
// opens (Tal 2026-11-23, "can we try with the notifications also?"). Spec:
// docs/spaces/nudges.md (Nudges spec) § Notifications list.
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
  listLabel: {
    id: 'nudges.notifications.list_label',
    defaultMessage: 'Notifications',
  },
  newBelow: {
    id: 'nudges.notifications.new_below',
    defaultMessage: 'New',
  },
});

// How close to an edge counts as being at it: the bottom, for staying
// with the newest; the top, for loading earlier ones.
const NEAR_BOTTOM = 80;
const NEAR_TOP = 200;

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

// Notifications, open in the Nudges pane: the first row of the list of
// chats (docs/spaces/nudges.md § Surfaces). The chats are beside it, or one
// step back on a phone, so it no longer points at unread messages itself.
export const NotificationsFace: React.FC = () => {
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

  // The first page, newest first as the server sends it. Loaded again when
  // something arrives: what comes back is merged in, so earlier pages
  // already scrolled into stay where they are.
  const loadedOnce = useRef(false);
  const load = useCallback(async () => {
    try {
      const page = await apiListNudgeNotifications();
      page.notifications.forEach((item) => {
        if (!item.seen) freshIds.current.add(item.id);
      });
      if (loadedOnce.current) {
        setItems((prev) => {
          const fresh = new Map(
            page.notifications.map((item) => [item.id, item]),
          );
          const kept = prev.filter((item) => !fresh.has(item.id));
          return [...page.notifications, ...kept].sort((a, b) =>
            b.created_at.localeCompare(a.created_at),
          );
        });
      } else {
        loadedOnce.current = true;
        setItems(page.notifications);
        setNextBefore(page.next_before);
      }
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

  // A notification that arrives while the face is open joins the bottom.
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

  // ── Scrolling, as a chat does ────────────────────────────────────
  // The list opens at the bottom and stays there while you are there; a
  // row that arrives while you have scrolled up shows "New" instead of
  // pulling you down. Earlier ones load as you near the top, holding what
  // you are looking at still while they slot in above it.
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  // The scroll height and position just before earlier rows went in.
  const prepending = useRef<{ height: number; top: number } | null>(null);
  const [newBelow, setNewBelow] = useState(false);

  const toBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    atBottom.current = true;
    setNewBelow(false);
  }, []);

  const handleEarlier = useCallback(() => {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    void (async () => {
      try {
        const page = await apiListNudgeNotifications(nextBefore);
        const el = scrollRef.current;
        if (el)
          prepending.current = { height: el.scrollHeight, top: el.scrollTop };
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

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    atBottom.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM;
    if (atBottom.current) setNewBelow(false);
    if (el.scrollTop < NEAR_TOP) handleEarlier();
  }, [handleEarlier]);

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

  // Opening the face is what marks things seen, system notices included.
  // Ones that arrived live sit in `pendingGroups` until something loads
  // them, and the read marker only ever moves over loaded groups; nothing
  // else in the app loads them any more, so they stayed unread, and the
  // pillar stayed lit, until a reload. Load them, then move the marker.
  useEffect(() => {
    dispatch(loadPending());
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

    return merged.sort((a, b) => a.at.localeCompare(b.at));
  }, [items, systemGroups, nextBefore]);

  // After the rows change: earlier ones went in above, so hold the view
  // where it was; or something new came in below, so follow it if you
  // were at the bottom and say so if you weren't.
  const newestKey = entries[entries.length - 1]?.key;
  const lastNewest = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const before = prepending.current;
    if (before) {
      prepending.current = null;
      el.scrollTop = before.top + (el.scrollHeight - before.height);
    } else if (atBottom.current) {
      el.scrollTop = el.scrollHeight;
    } else if (lastNewest.current && newestKey !== lastNewest.current) {
      setNewBelow(true);
    }
    lastNewest.current = newestKey;
  }, [entries, newestKey, status]);

  // Rows grow after they first paint (avatars, the strip above going), so
  // stay pinned to the bottom through that while you are there.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || status !== 'ready') return undefined;
    const observer = new ResizeObserver(() => {
      if (atBottom.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(el);
    Array.from(el.querySelectorAll('.nudges-notifications')).forEach(
      (child) => {
        observer.observe(child);
      },
    );
    return () => {
      observer.disconnect();
    };
  }, [status]);

  const isFreshGroup = (group: KronkSystemGroup) =>
    !!group.page_max_id &&
    compareId(group.page_max_id, arrivalMarker.current) > 0;

  return (
    <>
      {/* Pinned above the list, so it isn't scrolled away at the top of a
          list that opens at its bottom. */}
      <PushPrompt variant='strip' />

      <div
        className='stage-column nudges-notifications__scroll'
        ref={scrollRef}
        onScroll={handleScroll}
      >
        <div className='stage-column__inner'>
          {/* One surface for the whole list, so it reads on the sky in
              either theme. */}
          <div className='nudges-notifications'>
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

            {/* Earlier ones load on their own as you near the top; the
                pill is for when the list is too short to scroll, and for
                the keyboard. */}
            {status === 'ready' && nextBefore && (
              <div className='nudges-notifications__more'>
                <KornerPill
                  label={intl.formatMessage(messages.earlier)}
                  onClick={handleEarlier}
                  disabled={loadingMore}
                />
              </div>
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
          </div>
        </div>
      </div>

      {newBelow && (
        <div className='nudges-notifications__new'>
          <KornerPill
            label={intl.formatMessage(messages.newBelow)}
            icon={ArrowDownIcon}
            iconId='arrow_downward'
            variant='primary'
            onClick={toBottom}
          />
        </div>
      )}
    </>
  );
};
