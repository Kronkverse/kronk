import { createAction } from '@reduxjs/toolkit';

import { apiGetKorners, apiPostKornerSeen } from 'mastodon/api/korners';
import {
  createAppThunk,
  createDataLoadingThunk,
} from 'mastodon/store/typed_functions';

// Fetched once on app boot from features/ui/index.jsx#componentDidMount.
// Manifests are static per-deploy so we don't refetch until a page reload.
export const fetchKorners = createDataLoadingThunk(
  'korners/fetch',
  () => apiGetKorners(),
  (data) => data,
);

// Optimistic update of a korner's per-viewer tune-in state, so a toggle
// anywhere (e.g. the Hub settings pills) is reflected immediately across every
// surface that reads state.korners. The server call is fire-and-forget by the
// caller, which re-dispatches with the old value on failure.
export const setKornerTunedIn = createAction<{
  slug: string;
  tunedIn: boolean;
}>('korners/setTunedIn');

// Optimistic update of a korner's unread badge count. `all: true` clears it
// to 0 (the whole korner was opened); otherwise it decrements by one (a single
// post was seen — e.g. frothed in the feed). Keeps every surface reading
// state.korners in sync before the server round-trips. See lib/kronk/korner_seen.rb.
export const setKornerSeen = createAction<{
  slug: string;
  all?: boolean;
}>('korners/setSeen');

// Mark a korner fully seen when the viewer opens it: zero the badge
// optimistically, then persist via POST /api/v1/korners/:slug/seen. The server
// call is fire-and-forget — the badge is already 0 and the next korners fetch
// reconciles the truth.
export const markKornerSeen = createAppThunk(
  ({ slug }: { slug: string }, { dispatch }) => {
    dispatch(setKornerSeen({ slug, all: true }));
    void apiPostKornerSeen(slug);
  },
);
