import { createAction } from '@reduxjs/toolkit';

import { apiGetKorners } from 'mastodon/api/korners';
import { createDataLoadingThunk } from 'mastodon/store/typed_functions';

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
