import { createReducer } from '@reduxjs/toolkit';

import { fetchNudgesLegacyArchive } from 'mastodon/actions/nudges_legacy';
import type { ApiNotificationJSON } from 'mastodon/api_types/notifications';

interface NudgesLegacyState {
  entries: ApiNotificationJSON[];
  loading: boolean;
  loaded: boolean;
}

const initialState: NudgesLegacyState = {
  entries: [],
  loading: false,
  loaded: false,
};

export const nudgesLegacyReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(fetchNudgesLegacyArchive.pending, (state) => {
      state.loading = true;
    })
    .addCase(fetchNudgesLegacyArchive.fulfilled, (state, { payload, meta }) => {
      state.loading = false;
      state.loaded = true;

      const args = meta.arg as { maxId?: string } | undefined;
      const isPagination = Boolean(args?.maxId);

      if (isPagination) {
        state.entries.push(...payload);
      } else {
        state.entries = payload;
      }
    })
    .addCase(fetchNudgesLegacyArchive.rejected, (state) => {
      state.loading = false;
    });
});
