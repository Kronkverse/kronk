import type { Middleware, UnknownAction } from '@reduxjs/toolkit';

import { autosaveDraft } from 'mastodon/actions/compose';

import type { RootState, AppDispatch } from '..';

// Background autosave of the composer to the server — one rolling draft per
// account — so in-progress posts survive navigating away, a refresh, or a
// device switch. Watches for any change to the compose slice and, after a
// quiet period, dispatches the autosave thunk (which reads compose state and
// PUTs /api/v1/draft). Restore-on-mount and clear-on-publish live in the
// compose actions. The compose slice is Immutable, so an unchanged edit keeps
// the same reference and never triggers a save.
const DEBOUNCE_MS = 1500;

export const composeDraftMiddleware = (): Middleware<object, RootState> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastCompose: unknown;

  return (store) => (next) => (action) => {
    const result = next(action as UnknownAction);
    const { compose } = store.getState();

    if (compose !== lastCompose) {
      lastCompose = compose;

      if (timer) {
        clearTimeout(timer);
      }

      timer = setTimeout(() => {
        (store.dispatch as AppDispatch)(autosaveDraft());
      }, DEBOUNCE_MS);
    }

    return result;
  };
};
