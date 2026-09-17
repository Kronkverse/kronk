import { createAction } from '@reduxjs/toolkit';

import { usePendingItems as preferPendingItems } from 'mastodon/initial_state';

export const disconnectTimeline = createAction(
  'timeline/disconnect',
  ({ timeline }: { timeline: string }) => ({
    payload: {
      timeline,
      // Home never uses the pending-items gate (posts stream in and the feed
      // anchors upward), so a dropped connection must not queue a gap into
      // home's pending list either — that would surface a stray load bar.
      usePendingItems: timeline === 'home' ? false : preferPendingItems,
    },
  }),
);

export const timelineDelete = createAction<{
  statusId: string;
  accountId: string;
  references: string[];
  reblogOf: string | null;
}>('timelines/delete');
