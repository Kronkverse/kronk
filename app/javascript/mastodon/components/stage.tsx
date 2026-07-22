import { forwardRef, useRef, useImperativeHandle } from 'react';
import type { Ref } from 'react';

import { scrollTop } from 'mastodon/scroll';

// Kronk zonal layout — the Stage.
//
// The Kronk chrome is split into three named layers:
//
//   1. Frame — invariant, always-visible chrome (wordmark, membrane
//      switcher, korner sidebar, sub-bar). Fixed-position, owns
//      z-24/25.
//   2. Stage — the well-defined rectangle inside the frame edges.
//      Every korner space renders into it. Owns z-20, the single
//      vertical scrollbar, and any per-space backdrop (stars, etc.).
//   3. Content — per-space material inside the Stage. Owns its own
//      inner reading width; never fights the Stage for scroll.
//
// Stage is a peer to <Column>: routes pick whichever fits. Feed-style
// routes (home timeline) keep Column and its clamp; korner spaces
// use Stage so they fill the pane between the frame insets.
//
// Public API mirrors ColumnRef so existing scroll/refocus helpers can
// swap Stage in without ceremony.

export interface StageRef {
  scrollTop: () => void;
  node: HTMLDivElement | null;
}

interface StageProps {
  children?: React.ReactNode;
  label?: string;
  bindToDocument?: boolean;
}

export const Stage = forwardRef<StageRef, StageProps>(
  ({ children, label, bindToDocument }, ref: Ref<StageRef>) => {
    const nodeRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      node: nodeRef.current,

      scrollTop() {
        // With Stage the scrollable region is the Stage itself — no
        // inner `.scrollable` wrapper. `bindToDocument` is retained
        // for callers that historically deferred to document scroll,
        // but almost every Stage consumer wants the Stage's own
        // overflow.
        const scrollable = bindToDocument ? document.scrollingElement : nodeRef.current;
        if (!scrollable) return;
        scrollTop(scrollable);
      },
    }));

    return (
      <div ref={nodeRef} role='region' aria-label={label} className='kronk-stage'>
        {children}
      </div>
    );
  },
);

Stage.displayName = 'Stage';
