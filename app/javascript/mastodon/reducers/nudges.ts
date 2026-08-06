import { createReducer } from '@reduxjs/toolkit';

import { setNudgesUnread } from 'mastodon/actions/nudges';

interface NudgesState {
  unread: number;
}

const initialState: NudgesState = { unread: 0 };

// Nudge-native unread. Deliberately tiny — the source of truth is the server's
// per-conversation unread; this just holds the summed count for the badge,
// re-seeded on every conversation-list load (including the account-stream
// refresh), so it can never drift far from the server.
export const nudgesReducer = createReducer(initialState, (builder) => {
  builder.addCase(setNudgesUnread, (state, action) => {
    state.unread = action.payload;
  });
});
