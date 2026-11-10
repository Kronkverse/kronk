import { Component, createRef } from 'react';

import { reduceMotion } from '@/mastodon/initial_state';

interface Props {
  reach: string;
  order: string[];
  onScopeChange: (key: string) => void;
  children: React.ReactNode;
}

// FeedDrum — the home feed as the lower half of the scope spindle.
//
// The scope selector up top turns on a barrel; this turns the FEED on the same
// body. When scope changes, the feed does a solid quarter-turn: the current
// screen swings away edge-on while the next screen swings in from the side, both
// shaded by a veil (darkens the turning face) and a sheen (lifts the leading
// edge) — the exact shading the selector uses. It reads as one solid object
// rotating, not a panel sliding or a lone plane tilting.
//
// Ported from the design prototype's lower "deck" drum (kronk-prism.html): "not
// a separate carousel — the rest of the object." The prototype keeps a
// persistent N-face barrel of short, content-height faces; the real home feed is
// document-scrolled and effectively infinite, so a persistent barrel of live
// feeds doesn't map. Instead the turn is a TRANSITION: at rest the feed is the
// normal scrolling column; on a scope change we play a two-face quarter-turn
// (a cube edge) between a static snapshot of the outgoing feed and a static
// snapshot of the freshly-swapped incoming feed, then hand back to the live
// column. Two faces at 90deg keep the solid-body feel regardless of how many
// scopes exist (no 120deg lurch from a 3-face drum).
//
// Reduced motion skips the turn entirely — the feed just swaps.

const DUR = 900; // ms — keep in sync with --fd-dur in the stylesheet

// Walk up from a swipe's target to `stop`, bailing if anything on the way owns
// sideways drags itself: something that scrolls sideways (media galleries, the
// moments strip), something that takes every touch gesture (`touch-action:
// none`: the Kalendar spiral; the map, by class too, whatever its gesture
// settings), or the rotating title, which turns on its own swipe.
const ownsSidewaysDrag = (
  target: EventTarget | null,
  stop: Element | null,
): boolean => {
  let node = target instanceof Element ? target : null;
  while (node && node !== stop) {
    if (
      node.classList.contains('scope-title') ||
      node.classList.contains('maplibregl-map')
    )
      return true;
    const style = getComputedStyle(node);
    if (style.touchAction === 'none') return true;
    if (node.scrollWidth > node.clientWidth + 1) {
      if (style.overflowX === 'auto' || style.overflowX === 'scroll')
        return true;
    }
    node = node.parentElement;
  }
  return false;
};

// What a swipe never starts on, wherever it is on the page: anything you type
// in, menus, pop-ups drawn inside the space (a composer sheet), and anything
// marked `data-no-swipe` (an open Nudges chat).
const NOT_A_SWIPE =
  'input, textarea, select, [contenteditable="true"], form, [role="dialog"], [role="menu"], .hub-switcher, .kronk-menu, [data-no-swipe]';

// Swipe feel. The finger decides sideways or not once it has moved
// AXIS_LOCK_PX; dragging across the whole width is the whole quarter-turn.
// Letting go past COMMIT_FRACTION of the width, or flicking faster than
// FLICK_PX_PER_MS, finishes the turn; anything less springs back.
const AXIS_LOCK_PX = 10;
const COMMIT_FRACTION = 0.3;
const FLICK_PX_PER_MS = 0.35;
const FLICK_MIN_PX = 16;
const FINISH_MS = 420; // a swipe's turn from rest; less the further it got
const SPRING_BACK_MS = 240;
const FINISH_EASE = 'cubic-bezier(0.2, 0.7, 0.2, 1)';

interface Gesture {
  id: number;
  x0: number;
  y0: number;
  mode: 'pending' | 'drag' | 'off';
  samples: { x: number; t: number }[];
}

interface Drag {
  outgoing: HTMLElement;
  cube: HTMLElement;
  faces: { veil: HTMLElement; sheen: HTMLElement; angle: number }[];
  half: number;
  width: number;
  angle: number;
}

const shade = (angle: number) => ({
  veil: (Math.min(Math.abs(angle) / 90, 1) * 0.7).toFixed(3),
  sheen: (Math.abs(Math.sin((angle * Math.PI) / 180)) * 0.9).toFixed(3),
});

export class FeedDrum extends Component<Props> {
  private rootRef = createRef<HTMLDivElement>();
  private liveRef = createRef<HTMLDivElement>();

  private snapshot: HTMLElement | null = null; // outgoing feed, captured pre-swap
  private dir = 1;
  private overlay: HTMLElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  // swipe
  private gesture: Gesture | null = null;
  private drag: Drag | null = null;
  // A swipe that let go far enough: the turn carries on from where the finger
  // left the drum, with the snapshot taken when the drag began.
  private pendingTurn: {
    outgoing: HTMLElement;
    angle: number;
    dir: number;
  } | null = null;

  // Capture the outgoing feed's DOM the instant before React swaps in the new
  // scope — getSnapshotBeforeUpdate runs after render but before the commit, so
  // liveRef still holds the old feed here.
  getSnapshotBeforeUpdate(prev: Props) {
    if (
      prev.reach !== this.props.reach &&
      !reduceMotion &&
      this.liveRef.current
    ) {
      // Direction is wrap-aware around the closed scope ring, matching the
      // selector's own shortest-path turn — so both halves of the spindle turn
      // the SAME way, including across the seam (Mates -> Kronk continues
      // forward around the loop rather than reversing).
      const { order } = this.props;
      const n = order.length;
      const from = prev.order.indexOf(prev.reach);
      const to = order.indexOf(this.props.reach);
      let diff = to - from;
      if (from >= 0 && to >= 0 && n > 0) {
        if (diff > n / 2) diff -= n;
        if (diff < -n / 2) diff += n;
      }
      // A swipe turns the way the finger went, even where the ring is too
      // short to say (two faces are each other's next and previous).
      this.dir = this.pendingTurn?.dir ?? (diff < 0 ? -1 : 1);
      this.snapshot =
        this.pendingTurn?.outgoing ??
        (this.liveRef.current.cloneNode(true) as HTMLElement);
    }
    return null;
  }

  componentDidUpdate(prev: Props) {
    if (prev.reach !== this.props.reach && this.snapshot && !reduceMotion) {
      const outgoing = this.snapshot;
      const from = this.pendingTurn?.angle;
      this.snapshot = null;
      this.pendingTurn = null;
      try {
        this.playTurn(outgoing, from);
      } catch {
        // The turn is pure decoration — any DOM/3D failure must never break the
        // feed, so fall back to the plain swap.
        this.cleanup();
      }
    }
  }

  // The swipe listens on the whole page the drum sits in (the Stage, or Home's
  // column), not just the drum: on a short page the drum is a thin band, and
  // the space's other sections and the empty space below count too.
  //
  // It listens to touch events, not pointer events, and claims a sideways drag
  // by cancelling its first move. Pointer events lose the drag whenever the
  // touch starts inside a box that scrolls on its own (Treks, Nudges, any
  // full-height space): touch-action on the drum doesn't reach past that box,
  // so the browser takes the drag and cancels the pointer.
  private area: HTMLElement | null = null;

  componentDidMount() {
    const root = this.rootRef.current;
    if (!root) return;
    const area = root.closest<HTMLElement>('.kronk-stage, .column') ?? root;
    area.addEventListener('touchstart', this.handleTouchStart, {
      passive: true,
    });
    area.addEventListener('touchmove', this.handleTouchMove, {
      passive: false,
    });
    area.addEventListener('touchend', this.handleTouchEnd);
    area.addEventListener('touchcancel', this.handleTouchCancel);
    this.area = area;
  }

  componentWillUnmount() {
    const area = this.area;
    if (area) {
      area.removeEventListener('touchstart', this.handleTouchStart);
      area.removeEventListener('touchmove', this.handleTouchMove);
      area.removeEventListener('touchend', this.handleTouchEnd);
      area.removeEventListener('touchcancel', this.handleTouchCancel);
    }
    this.cleanup();
  }

  private cleanup = () => {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.overlay?.parentNode)
      this.overlay.parentNode.removeChild(this.overlay);
    this.overlay = null;
    this.drag = null;
    this.pendingTurn = null;
    if (this.liveRef.current) this.liveRef.current.style.opacity = '';
  };

  private buildFace(node: HTMLElement, angle: number, half: number) {
    const face = document.createElement('div');
    face.className = 'feed-drum__face';
    face.style.transform = `rotateY(${angle}deg) translateZ(${half}px)`;

    node.classList.add('feed-drum__content');
    const veil = document.createElement('div');
    veil.className = 'feed-drum__veil';
    const sheen = document.createElement('div');
    sheen.className = 'feed-drum__sheen';

    face.append(node, veil, sheen);
    return { face, veil, sheen };
  }

  // The visible band of the drum as an empty turning cube, laid over the live
  // feed (which is hidden while it turns). The feed is much taller than the
  // screen and scrolls the document; the faces only need the band from the
  // feed's top to the viewport bottom.
  private buildOverlay() {
    const root = this.rootRef.current;
    const live = this.liveRef.current;
    if (!root || !live) return null;

    const w = root.clientWidth;
    if (w === 0) return null;

    const rect = root.getBoundingClientRect();
    const h = Math.max(
      240,
      Math.min(rect.height, window.innerHeight - rect.top),
    );

    const overlay = document.createElement('div');
    overlay.className = 'feed-drum__overlay';
    overlay.style.height = `${h}px`;
    overlay.style.perspective = `${Math.max(w * 2.2, 1200)}px`;
    overlay.style.perspectiveOrigin = '50% 30%';

    const cube = document.createElement('div');
    cube.className = 'feed-drum__cube';
    overlay.appendChild(cube);

    root.appendChild(overlay);
    this.overlay = overlay;
    live.style.opacity = '0';

    return { cube, width: w, half: w / 2 };
  }

  // Sets the cube's angle and each face's shading: at once (`ms` 0), over the
  // stylesheet's turn (`ms` null), or over `ms` with `ease`.
  private setAngle(
    cube: HTMLElement,
    faces: { veil: HTMLElement; sheen: HTMLElement; angle: number }[],
    half: number,
    angle: number,
    ms: number | null,
    ease = '',
  ) {
    for (const el of [cube, ...faces.flatMap((f) => [f.veil, f.sheen])]) {
      el.style.transition = ms === 0 ? 'none' : '';
      el.style.transitionDuration = ms ? `${ms}ms` : '';
      el.style.transitionTimingFunction = ms ? ease : '';
    }
    cube.style.transform = `translateZ(${-half}px) rotateY(${angle}deg)`;
    for (const f of faces) {
      const s = shade(f.angle + angle);
      f.veil.style.opacity = s.veil;
      f.sheen.style.opacity = s.sheen;
    }
  }

  // The quarter-turn from the outgoing feed to the live one. A swipe hands
  // over the angle the finger left it at (`from`), and the turn finishes
  // from there, quicker the further it already got.
  private playTurn(outgoing: HTMLElement, from?: number) {
    const live = this.liveRef.current;
    if (!live) return;

    // Abandon any in-flight turn and snap it to done first.
    this.cleanup();

    const built = this.buildOverlay();
    if (!built) return;
    const { cube, half } = built;
    const dir = this.dir;

    const incoming = live.cloneNode(true) as HTMLElement;
    const out = this.buildFace(outgoing, 0, half);
    const inc = this.buildFace(incoming, dir * 90, half);
    cube.append(out.face, inc.face);
    const faces = [
      { ...out, angle: 0 },
      { ...inc, angle: dir * 90 },
    ];

    // Frame 0: outgoing at the front (or where the finger left it), incoming
    // to the side; commit it, then quarter-turn. CSS drives the ease
    // (matches the selector's turn) unless a swipe is finishing.
    const start = from ?? 0;
    this.setAngle(cube, faces, half, start, 0);
    void cube.offsetWidth;

    if (from === undefined) {
      this.setAngle(cube, faces, half, -dir * 90, null);
      this.timer = setTimeout(this.cleanup, DUR + 60);
      return;
    }
    const dur = Math.max(160, FINISH_MS * (1 - Math.abs(from) / 90));
    this.setAngle(cube, faces, half, -dir * 90, dur, FINISH_EASE);
    this.timer = setTimeout(this.cleanup, dur + 60);
  }

  // ── swipe to step scope (touch) ──
  // The drum follows the finger once a drag reads as sideways: the feed turns
  // away and a blank face comes round. Let go far enough (or flick) and the
  // scope steps, the turn finishing from where the finger left it; otherwise
  // it springs back. Vertical drags stay the page's scroll.
  private handleTouchStart = (e: TouchEvent) => {
    // A second finger (pinch) ends the swipe.
    if (e.touches.length > 1) {
      if (this.gesture) this.abandonGesture();
      return;
    }
    const t = e.changedTouches[0];
    if (!t) return;
    const target = e.target instanceof Element ? e.target : null;
    const off =
      !target ||
      !!target.closest(NOT_A_SWIPE) ||
      ownsSidewaysDrag(target, this.area);
    // Mid-turn, a new swipe snaps the turn to done and takes over (startDrag).
    this.gesture = {
      id: t.identifier,
      x0: t.clientX,
      y0: t.clientY,
      mode: off ? 'off' : 'pending',
      samples: [{ x: t.clientX, t: e.timeStamp }],
    };
  };

  private findTouch(e: TouchEvent) {
    const g = this.gesture;
    if (!g) return null;
    return Array.from(e.changedTouches).find((t) => t.identifier === g.id);
  }

  private handleTouchMove = (e: TouchEvent) => {
    const g = this.gesture;
    if (!g || g.mode === 'off') return;
    const t = this.findTouch(e);
    if (!t) return;

    const dx = t.clientX - g.x0;
    const dy = t.clientY - g.y0;
    g.samples.push({ x: t.clientX, t: e.timeStamp });
    while (g.samples.length > 2 && e.timeStamp - (g.samples[0]?.t ?? 0) > 100)
      g.samples.shift();

    if (g.mode === 'pending') {
      if (Math.hypot(dx, dy) < AXIS_LOCK_PX) return;
      // Already scrolling (the browser has the drag), up and down, or nowhere
      // to turn to: not a swipe.
      if (
        !e.cancelable ||
        Math.abs(dx) <= Math.abs(dy) ||
        this.props.order.length < 2
      ) {
        g.mode = 'off';
        return;
      }
      // With reduced motion nothing turns under the finger; letting go
      // still steps, and the feed just swaps.
      if (!reduceMotion && !this.startDrag()) {
        g.mode = 'off';
        return;
      }
      g.mode = 'drag';
    }

    // The drag is the drum's: the page doesn't scroll under it.
    if (e.cancelable) e.preventDefault();

    const drag = this.drag;
    if (!drag) return;
    drag.angle = Math.max(-90, Math.min(90, (dx / drag.width) * 90));
    this.setAngle(drag.cube, drag.faces, drag.half, drag.angle, 0);
  };

  private handleTouchEnd = (e: TouchEvent) => {
    const g = this.gesture;
    const t = this.findTouch(e);
    if (!g || !t) return;
    this.gesture = null;
    if (g.mode !== 'drag') return;

    const drag = this.drag;
    const width = drag?.width ?? this.rootRef.current?.clientWidth ?? 0;
    const dx = t.clientX - g.x0;
    const first = g.samples[0];
    const dt = first ? e.timeStamp - first.t : 0;
    const v = first && dt > 0 ? (t.clientX - first.x) / dt : 0;
    const far = Math.abs(dx) > width * COMMIT_FRACTION;
    const flick =
      Math.abs(v) > FLICK_PX_PER_MS &&
      Math.sign(v) === Math.sign(dx) &&
      Math.abs(dx) > FLICK_MIN_PX;

    if (!far && !flick) {
      this.springBack();
      return;
    }

    const dir = dx < 0 ? 1 : -1;
    if (!drag) {
      this.step(dir);
      return;
    }

    // Hand the drag over to the turn: it carries on from this angle once the
    // new scope has rendered. If no new scope comes, spring back.
    this.pendingTurn = { outgoing: drag.outgoing, angle: drag.angle, dir };
    if (!this.step(dir)) {
      this.springBack();
      return;
    }
    this.timer = setTimeout(() => {
      if (this.pendingTurn) this.springBack();
    }, 600);
  };

  private handleTouchCancel = (e: TouchEvent) => {
    if (this.findTouch(e)) this.abandonGesture();
  };

  private abandonGesture() {
    const dragging = this.gesture?.mode === 'drag';
    this.gesture = null;
    if (dragging) this.springBack();
  }

  // The live feed turning under the finger: a snapshot of it on the front of
  // the cube, and blank faces either side for whichever way it goes.
  private startDrag() {
    const live = this.liveRef.current;
    if (!live) return false;
    this.cleanup();

    const built = this.buildOverlay();
    if (!built) return false;
    const { cube, half, width } = built;

    const outgoing = live.cloneNode(true) as HTMLElement;
    const out = this.buildFace(outgoing, 0, half);
    const next = this.buildFace(document.createElement('div'), 90, half);
    const prev = this.buildFace(document.createElement('div'), -90, half);
    cube.append(out.face, next.face, prev.face);

    this.drag = {
      outgoing,
      cube,
      faces: [
        { ...out, angle: 0 },
        { ...next, angle: 90 },
        { ...prev, angle: -90 },
      ],
      half,
      width,
      angle: 0,
    };
    this.setAngle(cube, this.drag.faces, half, 0, 0);
    return true;
  }

  private springBack() {
    const drag = this.drag;
    this.pendingTurn = null;
    if (!drag) {
      this.cleanup();
      return;
    }
    if (this.timer) clearTimeout(this.timer);
    this.setAngle(drag.cube, drag.faces, drag.half, 0, SPRING_BACK_MS);
    this.timer = setTimeout(this.cleanup, SPRING_BACK_MS + 40);
  }

  private step(delta: number) {
    const { order, reach, onScopeChange } = this.props;
    const n = order.length;
    const idx = order.indexOf(reach);
    if (idx < 0 || n === 0) return false;
    // Wrap around the ring, like the selector: a flick past the last scope
    // continues around to the first.
    const next = order[(((idx + delta) % n) + n) % n];
    if (next === undefined || next === reach) return false;
    onScopeChange(next);
    return true;
  }

  render() {
    return (
      <div
        className='feed-drum'
        ref={this.rootRef}
        style={{ touchAction: 'pan-y' }}
      >
        <div className='feed-drum__live' ref={this.liveRef}>
          {this.props.children}
        </div>
      </div>
    );
  }
}
