import { createAction } from '@reduxjs/toolkit';

import { apiGetKorners, apiPostKornerSeen } from 'mastodon/api/korners';
import {
  createAppThunk,
  createDataLoadingThunk,
} from 'mastodon/store/typed_functions';

import { importFetchedStatuses } from './importer';

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

// What opening a korner cleared, for "since you were last here"
// (<SinceLastVisit>). `null` forgets it (the viewer hid the strip).
export const setKornerSinceLastVisit = createAction<{
  slug: string;
  since: { count: number; status_ids: string[] } | null;
}>('korners/setSinceLastVisit');

// Mark a korner fully seen when the viewer opens it: zero the badge
// optimistically, then persist via POST /api/v1/korners/:slug/seen. The answer
// says what that cleared; its posts are imported and kept for "since you were
// last here". A failed call changes nothing — the badge is already 0 and the
// next korners fetch reconciles the truth.
export const markKornerSeen = createAppThunk(
  async ({ slug }: { slug: string }, { dispatch }) => {
    dispatch(setKornerSeen({ slug, all: true }));

    try {
      const { since_last_visit: since } = await apiPostKornerSeen(slug);
      if (since.count === 0) return;

      dispatch(importFetchedStatuses(since.statuses));
      dispatch(
        setKornerSinceLastVisit({
          slug,
          since: {
            count: since.count,
            status_ids: since.statuses.map((status) => status.id),
          },
        }),
      );
    } catch {
      // Nothing to show; the badge stays cleared.
    }
  },
);
