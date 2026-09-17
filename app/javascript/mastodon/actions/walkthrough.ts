import { createAction } from '@reduxjs/toolkit';

import { createAppAsyncThunk } from 'mastodon/store/typed_functions';

import api from '../api';

// First-run tour actions. Spec: docs/kronk_walkthrough.md.
// Persistence is layered:
//   * `walkthrough_dismissed` on the server (account-scoped, follows the
//     user across devices) — the ONE flag that matters cross-device.
//     See app/models/user_settings.rb + walkthrough_controller.rb.
//   * Everything else (currentIdx, dontShow, seen_ids for the current
//     run) in localStorage — per-browser resume state, not worth the
//     round-trip.

export const startWalkthrough = createAction<{ atIdx?: number } | undefined>(
  'walkthrough/start',
);

export const advanceWalkthrough = createAction('walkthrough/next');
export const rewindWalkthrough = createAction('walkthrough/prev');

export const closeWalkthrough = createAction('walkthrough/close');
export const dismissWalkthrough = createAction('walkthrough/dismiss');
export const restartWalkthrough = createAction('walkthrough/restart');

export const setDontShowAgain = createAction<{ value: boolean }>(
  'walkthrough/setDontShowAgain',
);
export const markStepSeen = createAction<{ id: string }>(
  'walkthrough/markSeen',
);

// Server-side PATCH — fire-and-forget from the runner when the user
// dismisses or restarts. We don't await it or block the UI on it;
// localStorage keeps the same session honest even if the network fails.
export const persistWalkthroughDismissed = createAppAsyncThunk(
  'walkthrough/persistDismissed',
  async (dismissed: boolean) => {
    await api().put('/api/v1/settings/walkthrough', { dismissed });
    return dismissed;
  },
);
