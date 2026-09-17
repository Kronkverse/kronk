import { forwardRef, useRef, useImperativeHandle, useEffect } from 'react';
import type { Ref } from 'react';

import { scrollTop } from 'mastodon/scroll';
import { isDevelopment } from 'mastodon/utils/environment';

import { SpaceHeaderOverrideProvider } from './space_header_override';
import { SpaceHeaderRow } from './space_header_row';

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
        const scrollable = bindToDocument
          ? document.scrollingElement
          : nodeRef.current;
        if (!scrollable) return;
        scrollTop(scrollable);
      },
    }));

    // Dev-only Frame-parasite warning. The static `korners doctor` L11
    // check catches the same patterns at CI time; this catches them at
    // runtime for anything the grep can't see (a subtree flipped in
    // by conditional render, or content loaded from a fetch). One warn
    // per mount, keyed on `label` so it doesn't spam on re-renders.
    // See docs/korners/korner_standard.md L11 for the rationale.
    useEffect(() => {
      if (!isDevelopment()) return;
      const node = nodeRef.current;
      if (!node) return;

      const parasites: string[] = [];
      // The Frame-provided <AutoSpaceHeader> is a legitimate <h1>
      // owner (marked `data-frame-header`). Any other <h1> in the
      // subtree is a parasite — duplicating the same title the header
      // already renders.
      const foreignH1s = Array.from(node.querySelectorAll('h1')).filter(
        (h) => !h.closest('[data-frame-header]'),
      );
      if (foreignH1s.length > 0) {
        parasites.push(
          '<h1> — the space title is provided by <AutoSpaceHeader>',
        );
      }
      if (node.querySelector('[role="tablist"], [role="tab"]')) {
        parasites.push(
          'role="tablist"/"tab" — the view tabs are provided by <AutoSpaceViewPicker>, driven by the manifest `views:` list',
        );
      }
      if (parasites.length > 0) {
        console.warn(
          `[kronk-frame] Frame parasite in Stage (${label ?? 'unlabelled'}):\n  - ${parasites.join('\n  - ')}\n  See docs/korners/korner_standard.md L11 and docs/kronk_frame.md.`,
        );
      }
    }, [label]);

    return (
      // Provider lets any mounted korner route push a ReactNode into the
      // Frame's SpaceHeader slot (see space_header_override.tsx). It wraps
      // both <SpaceHeaderRow> (which contains <AutoSpaceHeader>) and the
      // route children so they share the same override state.
      <SpaceHeaderOverrideProvider>
        <div
          ref={nodeRef}
          role='region'
          aria-label={label}
          className='kronk-stage'
        >
          <SpaceHeaderRow />
          {children}
        </div>
      </SpaceHeaderOverrideProvider>
    );
  },
);

Stage.displayName = 'Stage';
