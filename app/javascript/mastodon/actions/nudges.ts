import { createAction } from '@reduxjs/toolkit';

// The two counts behind the Nudges pillar badge. Each is re-seeded from the
// server (never adjusted by a delta) on load and on every account-stream
// arrival, so neither can drift.

// Unread across the viewer's chats: Σ of each conversation's unread.
export const setNudgesUnread = createAction<number>('nudges/setUnread');

// Notifications the viewer has not seen yet.
export const setNudgesUnseenNotifications = createAction<number>(
  'nudges/setUnseenNotifications',
);
