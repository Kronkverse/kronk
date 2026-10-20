import { createReducer } from '@reduxjs/toolkit';

import {
  fetchKorners,
  setKornerSeen,
  setKornerSinceLastVisit,
  setKornerTunedIn,
} from 'mastodon/actions/korners';
import type { ApiKornerJSON } from 'mastodon/api_types/korners';

// Indexed by slug for O(1) hook lookups. Empty until fetchKorners
// resolves (a few hundred ms after app boot).
const initialState: Record<string, ApiKornerJSON> = {};

export const kornersReducer = createReducer(initialState, (builder) => {
  builder.addCase(fetchKorners.fulfilled, (state, { payload }) => {
    for (const manifest of payload) {
      // A refetch keeps what this session's visit cleared.
      const since = state[manifest.slug]?.since_last_visit;
      state[manifest.slug] = since
        ? { ...manifest, since_last_visit: since }
        : manifest;
    }
  });
  builder.addCase(setKornerTunedIn, (state, { payload }) => {
    const korner = state[payload.slug];
    if (korner) korner.tuned_in = payload.tunedIn;
  });
  builder.addCase(setKornerSeen, (state, { payload }) => {
    const korner = state[payload.slug];
    if (!korner) return;
    korner.unread_count = payload.all
      ? 0
      : Math.max(0, (korner.unread_count ?? 0) - 1);
  });
  builder.addCase(setKornerSinceLastVisit, (state, { payload }) => {
    const korner = state[payload.slug];
    if (!korner) return;
    if (payload.since) korner.since_last_visit = payload.since;
    else delete korner.since_last_visit;
  });
});
