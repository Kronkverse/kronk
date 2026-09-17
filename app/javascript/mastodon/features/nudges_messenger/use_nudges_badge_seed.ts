import { useCallback, useEffect } from 'react';

import { setNudgesUnread } from 'mastodon/actions/nudges';
import { apiListNudgeConversations } from 'mastodon/api/nudges_conversations';
import { useAppDispatch } from 'mastodon/store';

import { useNudgesAccountStream } from './use_nudges_account_stream';

// Seed and keep-alive for the account-wide unread nudge count that
// backs the HubSwitcher's Nudges pillar badge.
//
// The nudges messenger itself already fetches conversations + reseeds
// on mount, but that only runs when the user opens `/nudges`. Before
// this hook existed, the pillar badge stayed at zero for the entire
// session until the user clicked through — which defeated the point
// of the badge. Mount this from a chrome-level component (the
// HubSwitcher) so the badge is correct from first paint and stays
// current via the same account-level stream the messenger uses.
//
// One HTTP fetch on boot; then the stream carries the rest. Repeat
// stream events call the same `apiListNudgeConversations` +
// `setNudgesUnread(sum)` cycle, so the badge is always the truth from
// the server, never a delta we might miscompute.
export const useNudgesBadgeSeed = () => {
  const dispatch = useAppDispatch();

  const refresh = useCallback(async () => {
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

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onStreamActivity = useCallback(() => {
    void refresh();
  }, [refresh]);
  useNudgesAccountStream(onStreamActivity);
};
