import { useCallback, useEffect } from 'react';

import { useHistory, useLocation } from 'react-router-dom';

import {
  advanceWalkthrough,
  closeWalkthrough,
  markStepSeen,
  persistWalkthroughDismissed,
  rewindWalkthrough,
  setDontShowAgain,
  startWalkthrough,
} from 'mastodon/actions/walkthrough';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

import { WalkthroughStep } from './step';
import { INTRO_STEPS } from './steps';

// Owns the tour lifecycle: auto-fires on first paint, advances/rewinds,
// navigates to each step's route, closes.
//
// Mount inside `features/ui/index.jsx` under the same signed-in guard
// as <KronkMenu>. Only one instance per app.

export const WalkthroughRunner: React.FC = () => {
  const dispatch = useAppDispatch();
  const history = useHistory();
  const location = useLocation();
  const active = useAppSelector((state) => state.walkthrough.active);
  const dismissedAt = useAppSelector((state) => state.walkthrough.dismissedAt);
  const currentIdx = useAppSelector((state) => state.walkthrough.currentIdx);
  const dontShow = useAppSelector((state) => state.walkthrough.dontShow);

  // Auto-fire on first-ever visit. `dismissedAt` sticks once set —
  // only `restartWalkthrough` (Settings → Help, future PR) clears it.
  useEffect(() => {
    if (dismissedAt || active) return;
    // Slight delay so the initial layout settles before the overlay
    // takes over — feels less rude.
    const t = window.setTimeout(() => {
      dispatch(startWalkthrough(undefined));
    }, 500);
    return () => {
      window.clearTimeout(t);
    };
    // dismissedAt/active are what matter — we don't want to re-fire if
    // the user closes it mid-run.
  }, [dispatch, dismissedAt, active]);

  const step = INTRO_STEPS[currentIdx] ?? INTRO_STEPS[0];

  // Route sync — when the runner advances into a step whose route
  // isn't current, push it. We deliberately don't push if the user
  // has already navigated to a different route mid-tour (their choice
  // wins; the runner just re-anchors on the current route).
  useEffect(() => {
    if (!active || !step) return;
    if (location.pathname === step.route) return;
    history.push(step.route);
    // Only depend on step.route + active — location.pathname changes
    // via history.push cause a re-run we don't want.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step?.route]);

  // Mark seen on show.
  useEffect(() => {
    if (!active || !step) return;
    dispatch(markStepSeen({ id: step.id }));
  }, [active, step, dispatch]);

  const handlePrev = useCallback(() => {
    dispatch(rewindWalkthrough());
  }, [dispatch]);
  // `dontShow` at the time of close is what triggers the server PATCH.
  // If the user hit Finish OR × while ticked, we persist true. If they
  // just closed without ticking, no round-trip — the tour can still
  // re-fire in a fresh browser (they didn't ask us to shut up forever).
  const persistIfDismissed = useCallback(() => {
    if (dontShow) {
      void dispatch(persistWalkthroughDismissed(true));
    }
  }, [dispatch, dontShow]);

  const handleNext = useCallback(() => {
    if (currentIdx === INTRO_STEPS.length - 1) {
      persistIfDismissed();
      dispatch(closeWalkthrough());
    } else {
      dispatch(advanceWalkthrough());
    }
  }, [dispatch, currentIdx, persistIfDismissed]);
  const handleClose = useCallback(() => {
    persistIfDismissed();
    dispatch(closeWalkthrough());
  }, [dispatch, persistIfDismissed]);
  const handleToggleDontShow = useCallback(
    (value: boolean) => {
      dispatch(setDontShowAgain({ value }));
    },
    [dispatch],
  );

  // Keyboard shortcuts — global while the tour is active.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [active, handleClose, handleNext, handlePrev]);

  if (!active || !step) return null;

  return (
    <WalkthroughStep
      index={currentIdx}
      total={INTRO_STEPS.length}
      title={step.title}
      body={step.body}
      anchor={step.anchor}
      dontShow={dontShow}
      onPrev={handlePrev}
      onNext={handleNext}
      onClose={handleClose}
      onToggleDontShow={handleToggleDontShow}
    />
  );
};

// Selector consumed by <KronkMenu> so it force-opens itself when the
// tour reaches a step that needs the ring visible. Kept here (next to
// the runner + steps) so the coupling is discoverable in one place.
export const selectWalkthroughForceZhOpen = (state: {
  walkthrough: { active: boolean; currentIdx: number };
}): boolean => {
  if (!state.walkthrough.active) return false;
  return INTRO_STEPS[state.walkthrough.currentIdx]?.openZhMenu === true;
};
