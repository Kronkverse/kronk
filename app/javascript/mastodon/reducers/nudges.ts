import { createReducer } from '@reduxjs/toolkit';

import {
  setNudgesUnread,
  setNudgesUnseenNotifications,
} from 'mastodon/actions/nudges';

interface NudgesState {
  // Unread in chats (the Messages face).
  unread: number;
  // Unseen on the Notifications face.
  unseenNotifications: number;
}

const initialState: NudgesState = { unread: 0, unseenNotifications: 0 };

// Deliberately tiny — the source of truth is the server. This just holds the
// two counts for the badge, re-seeded on every load and stream arrival.
export const nudgesReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(setNudgesUnread, (state, action) => {
      state.unread = action.payload;
    })
    .addCase(setNudgesUnseenNotifications, (state, action) => {
      state.unseenNotifications = action.payload;
    });
});
