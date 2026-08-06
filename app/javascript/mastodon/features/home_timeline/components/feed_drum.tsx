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

// Walk up from a swipe's target to `stop`, bailing if any ancestor is itself
// horizontally scrollable — those own the horizontal axis (media galleries, the
// moments strip) and must not have their scroll stolen to change scope.
const hasHorizontalScrollAncestor = (
  target: EventTarget | null,
  stop: Element | null,
): boolean => {
  let node = target instanceof Element ? target : null;
  while (node && node !== stop) {
    if (node.scrollWidth > node.clientWidth + 1) {
      const overflowX = getComputedStyle(node).overflowX;
      if (overflowX === 'auto' || overflowX === 'scroll') return true;
    }
    node = node.parentElement;
  }
  return false;
};

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
  private downX: number | null = null;
  private downY: number | null = null;
  private swipeTarget: EventTarget | null = null;

  // Capture the outgoing feed's DOM the instant before React swaps in the new
  // scope — getSnapshotBeforeUpdate runs after render but before the commit, so
  // liveRef still holds the old feed here.
  getSnapshotBeforeUpdate(prev: Props) {
    if (
      prev.reach !== this.props.reach &&
      !reduceMotion &&
      this.liveRef.current
    ) {
      const from = prev.order.indexOf(prev.reach);
      const to = this.props.order.indexOf(this.props.reach);
      this.dir = from >= 0 && to >= 0 && to < from ? -1 : 1;
      this.snapshot = this.liveRef.current.cloneNode(true) as HTMLElement;
    }
    return null;
  }

  componentDidUpdate(prev: Props) {
    if (prev.reach !== this.props.reach && this.snapshot && !reduceMotion) {
      const outgoing = this.snapshot;
      this.snapshot = null;
      try {
        this.playTurn(outgoing);
      } catch {
        // The turn is pure decoration — any DOM/3D failure must never break the
        // feed, so fall back to the plain swap.
        this.cleanup();
      }
    }
  }

  componentWillUnmount() {
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

  private playTurn(outgoing: HTMLElement) {
    const root = this.rootRef.current;
    const live = this.liveRef.current;
    if (!root || !live) return;

    // Abandon any in-flight turn and snap it to done first.
    this.cleanup();

    const w = root.clientWidth;
    if (w === 0) return;
    const half = w / 2;
    const dir = this.dir;

    // The feed is much taller than the screen and scrolls the document; the
    // turning faces only need the visible band, from the feed's top to the
    // viewport bottom.
    const rect = root.getBoundingClientRect();
    const h = Math.max(
      240,
      Math.min(rect.height, window.innerHeight - rect.top),
    );

    const incoming = live.cloneNode(true) as HTMLElement;

    const overlay = document.createElement('div');
    overlay.className = 'feed-drum__overlay';
    overlay.style.height = `${h}px`;
    overlay.style.perspective = `${Math.max(w * 2.2, 1200)}px`;
    overlay.style.perspectiveOrigin = '50% 30%';

    const cube = document.createElement('div');
    cube.className = 'feed-drum__cube';
    overlay.appendChild(cube);

    const out = this.buildFace(outgoing, 0, half);
    const inc = this.buildFace(incoming, dir * 90, half);
    cube.append(out.face, inc.face);

    root.appendChild(overlay);
    this.overlay = overlay;
    live.style.opacity = '0';

    // Frame 0 — transitions off; outgoing flat at front, incoming edge-on to the
    // side. (Outgoing at front matches what was already on screen → no jump.)
    const s0out = shade(0);
    const s0in = shade(dir * 90);
    cube.style.transition = 'none';
    cube.style.transform = `translateZ(${-half}px) rotateY(0deg)`;
    for (const el of [out.veil, out.sheen, inc.veil, inc.sheen])
      el.style.transition = 'none';
    out.veil.style.opacity = s0out.veil;
    out.sheen.style.opacity = s0out.sheen;
    inc.veil.style.opacity = s0in.veil;
    inc.sheen.style.opacity = s0in.sheen;

    // Commit that frame, then quarter-turn: incoming swings to front, outgoing
    // swings away. CSS drives the ease (matches the selector's turn).
    void cube.offsetWidth;
    const s1out = shade(-dir * 90);
    const s1in = shade(0);
    cube.style.transition = '';
    cube.style.transform = `translateZ(${-half}px) rotateY(${-dir * 90}deg)`;
    for (const el of [out.veil, out.sheen, inc.veil, inc.sheen])
      el.style.transition = '';
    out.veil.style.opacity = s1out.veil;
    out.sheen.style.opacity = s1out.sheen;
    inc.veil.style.opacity = s1in.veil;
    inc.sheen.style.opacity = s1in.sheen;

    this.timer = setTimeout(this.cleanup, DUR + 60);
  }

  // ── swipe to step scope (touch, strictly horizontal) ──
  private handlePointerDown = (e: React.PointerEvent) => {
    this.downX = e.clientX;
    this.downY = e.clientY;
    this.swipeTarget = e.target;
  };

  private handlePointerUp = (e: React.PointerEvent) => {
    if (this.downX === null || this.downY === null) return;
    const dx = e.clientX - this.downX;
    const dy = e.clientY - this.downY;
    const target = this.swipeTarget;
    this.downX = this.downY = null;
    this.swipeTarget = null;

    if (e.pointerType !== 'touch') return;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (hasHorizontalScrollAncestor(target, this.rootRef.current)) return;
    this.step(dx < 0 ? 1 : -1);
  };

  private handlePointerCancel = () => {
    this.downX = this.downY = null;
    this.swipeTarget = null;
  };

  private step(delta: number) {
    const { order, reach, onScopeChange } = this.props;
    const idx = order.indexOf(reach);
    if (idx < 0) return;
    const next = order[idx + delta];
    if (next === undefined) return;
    onScopeChange(next);
  }

  render() {
    return (
      <div
        className='feed-drum'
        ref={this.rootRef}
        style={{ touchAction: 'pan-y' }}
        onPointerDown={this.handlePointerDown}
        onPointerUp={this.handlePointerUp}
        onPointerCancel={this.handlePointerCancel}
      >
        <div className='feed-drum__live' ref={this.liveRef}>
          {this.props.children}
        </div>
      </div>
    );
  }
}
