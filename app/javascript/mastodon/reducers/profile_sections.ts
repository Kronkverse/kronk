import { createReducer } from '@reduxjs/toolkit';

import {
  fetchProfileSections,
  reorderProfileSections,
} from 'mastodon/actions/profile_sections';
import type { ApiProfileSectionJSON } from 'mastodon/api/profile_sections';

// Ordered list of the current user's own sections (by position). Empty
// until fetchProfileSections resolves. Timeline section is always
// present after the backfill runs on any live account.
const initialState: ApiProfileSectionJSON[] = [];

export const profileSectionsReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(fetchProfileSections.fulfilled, (_state, { payload }) => payload)
    .addCase(reorderProfileSections.fulfilled, (_state, { payload }) => payload);
});
