import { createAction } from '@reduxjs/toolkit';

// First-run tour actions. Spec: docs/kronk_walkthrough.md.
// v1 persistence: localStorage only (see reducers/walkthrough.ts).
// Server-side settings_store["walkthrough_seen"] follow-up PR.

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
