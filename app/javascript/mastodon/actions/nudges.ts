import { createAction } from '@reduxjs/toolkit';

// The account-wide unread nudge count — Σ over the viewer's conversations of
// their unread (messages AND nudge events). Seeded from the conversation-list
// load and kept live by the account-level stream. This is the nudge-native
// source for the pillar/nav badge, replacing the read off the Mastodon
// notification store (which is now legacy-only).
export const setNudgesUnread = createAction<number>('nudges/setUnread');
