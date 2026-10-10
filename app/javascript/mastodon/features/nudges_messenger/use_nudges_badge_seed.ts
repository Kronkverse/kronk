import { useCallback, useEffect } from 'react';

import {
  setNudgesUnread,
  setNudgesUnseenNotifications,
} from 'mastodon/actions/nudges';
import { apiListNudgeConversations } from 'mastodon/api/nudges_conversations';
import { apiGetNudgeUnseenCount } from 'mastodon/api/nudges_notifications';
import { useAppDispatch } from 'mastodon/store';

import { useNudgesAccountStream } from './use_nudges_account_stream';
import type { NudgesArrival } from './use_nudges_account_stream';

// Seed and keep-alive for the two counts behind the HubSwitcher's Nudges
// pillar badge: unread in chats, and unseen notifications.
//
// Nudges itself reseeds both when it is open, but that only runs once the
// user is on `/nudges`. Mount this from a chrome-level component (the
// HubSwitcher) so the badge is correct from first paint and stays current
// via the same account-level stream Nudges uses.
//
// Two HTTP fetches on boot; then the stream carries the rest, refetching
// only the count that the arrival touches. Always the truth from the
// server, never a delta we might miscompute.
export const useNudgesBadgeSeed = () => {
  const dispatch = useAppDispatch();

  const refreshChats = useCallback(async () => {
    try {
      const data = await apiListNudgeConversations();
      dispatch(
        setNudgesUnread(data.reduce((sum, c) => sum + c.unread_count, 0)),
      );
    } catch {
      // Non-fatal — a failed reseed leaves the last known count in
      // place. Next stream event will retry.
    }
  }, [dispatch]);

  const refreshNotifications = useCallback(async () => {
    try {
      const { unseen_count: unseen } = await apiGetNudgeUnseenCount();
      dispatch(setNudgesUnseenNotifications(unseen));
    } catch {
      // Non-fatal, as above.
    }
  }, [dispatch]);

  useEffect(() => {
    void refreshChats();
    void refreshNotifications();
  }, [refreshChats, refreshNotifications]);

  const onStreamActivity = useCallback(
    (arrival: NudgesArrival) => {
      if (arrival === 'notification') void refreshNotifications();
      else void refreshChats();
    },
    [refreshChats, refreshNotifications],
  );
  useNudgesAccountStream(onStreamActivity);
};
