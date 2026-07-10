import { createReducer } from '@reduxjs/toolkit';

import { fetchKorners } from 'mastodon/actions/korners';
import type { ApiKornerJSON } from 'mastodon/api_types/korners';

// Indexed by slug for O(1) hook lookups. Empty until fetchKorners
// resolves (a few hundred ms after app boot).
const initialState: Record<string, ApiKornerJSON> = {};

export const kornersReducer = createReducer(initialState, (builder) => {
  builder.addCase(fetchKorners.fulfilled, (state, { payload }) => {
    for (const manifest of payload) {
      state[manifest.slug] = manifest;
    }
  });
});
