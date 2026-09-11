import { createReducer } from '@reduxjs/toolkit';

import {
  advanceWalkthrough,
  closeWalkthrough,
  dismissWalkthrough,
  markStepSeen,
  restartWalkthrough,
  rewindWalkthrough,
  setDontShowAgain,
  startWalkthrough,
} from 'mastodon/actions/walkthrough';
import { INTRO_STEPS } from 'mastodon/components/walkthrough/steps';

export interface WalkthroughState {
  // `active` toggles the overlay + bubble on. Distinct from
  // `dismissedAt`: a user who taps ×-close but hasn't ticked "Don't show
  // again" keeps `dismissedAt` null and can be re-fired on next visit
  // (until they finish or dismiss). Once dismissed, `active` stays
  // false and only `restartWalkthrough` re-opens.
  active: boolean;
  currentIdx: number;
  dontShow: boolean;
  dismissedAt: string | null;
  seenIds: string[];
}

const STORAGE_KEY = 'kronk.walkthrough.seen.v1';

interface Persisted {
  active?: { idx: number; dontShow: boolean } | null;
  seen_ids?: string[];
  dismissed_at?: string | null;
}

function hydrate(): WalkthroughState {
  if (typeof window === 'undefined') {
    return {
      active: false,
      currentIdx: 0,
      dontShow: false,
      dismissedAt: null,
      seenIds: [],
    };
  }
  let raw: Persisted = {};
  try {
    raw = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? '{}',
    ) as Persisted;
  } catch {
    // Corrupt entry — treat as first-run.
    raw = {};
  }
  return {
    active: false,
    currentIdx: raw.active?.idx ?? 0,
    dontShow: raw.active?.dontShow ?? false,
    dismissedAt: raw.dismissed_at ?? null,
    seenIds: raw.seen_ids ?? [],
  };
}

function persist(state: WalkthroughState) {
  if (typeof window === 'undefined') return;
  const payload: Persisted = {
    active: state.active
      ? { idx: state.currentIdx, dontShow: state.dontShow }
      : null,
    seen_ids: state.seenIds,
    dismissed_at: state.dismissedAt,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage full / disabled — the tour still works in-memory for
    // this session; we just can't skip it on reload.
  }
}

const initialState: WalkthroughState = hydrate();

export const walkthroughReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(startWalkthrough, (state, { payload }) => {
      state.active = true;
      state.currentIdx = payload?.atIdx ?? state.currentIdx;
      persist(state);
    })
    .addCase(advanceWalkthrough, (state) => {
      const next = Math.min(INTRO_STEPS.length - 1, state.currentIdx + 1);
      state.currentIdx = next;
      persist(state);
    })
    .addCase(rewindWalkthrough, (state) => {
      state.currentIdx = Math.max(0, state.currentIdx - 1);
      persist(state);
    })
    .addCase(closeWalkthrough, (state) => {
      state.active = false;
      if (state.dontShow) {
        state.dismissedAt = new Date().toISOString();
      }
      persist(state);
    })
    .addCase(dismissWalkthrough, (state) => {
      state.active = false;
      state.dismissedAt = new Date().toISOString();
      persist(state);
    })
    .addCase(restartWalkthrough, (state) => {
      state.active = true;
      state.currentIdx = 0;
      state.dontShow = false;
      state.dismissedAt = null;
      state.seenIds = [];
      persist(state);
    })
    .addCase(setDontShowAgain, (state, { payload }) => {
      state.dontShow = payload.value;
      persist(state);
    })
    .addCase(markStepSeen, (state, { payload }) => {
      if (!state.seenIds.includes(payload.id)) {
        state.seenIds.push(payload.id);
        persist(state);
      }
    });
});
