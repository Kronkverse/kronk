import { createReducer } from '@reduxjs/toolkit';

import { showAlert, dismissAlert, clearAlerts } from 'mastodon/actions/alerts';
import type { Alert } from 'mastodon/models/alert';

const initialState: Alert[] = [];

let id = 0;

const sameText = (a: Omit<Alert, 'key'>, b: Omit<Alert, 'key'>) =>
  JSON.stringify([a.title, a.message, a.values]) ===
  JSON.stringify([b.title, b.message, b.values]);

export const alertsReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(showAlert, (state, { payload }) => {
      // One error at a time: a new error replaces the one on screen, and an
      // alert identical to one already showing replaces it rather than
      // stacking. A burst of failed requests (a 502 while the server
      // restarts) used to fill the page edge with copies of the same toast.
      const kept = state.filter(
        (item) => !(payload.error && item.error) && !sameText(item, payload),
      );
      kept.push({ key: id++, ...payload });
      return kept;
    })
    .addCase(dismissAlert, (state, { payload: { key } }) => {
      return state.filter((item) => item.key !== key);
    })
    .addCase(clearAlerts, () => {
      return [];
    });
});
