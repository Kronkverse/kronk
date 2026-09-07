// KalendarSpiral — React port of the /kalendar-spiral-preview.html
// prototype (a 1119-line static HTML file mounted in the Kalendar
// through an <iframe>). This component is a preview mount, opt-in
// via `?variant=react` on /hub/kalendar (Tal 2026-09-07). Once
// shipped and verified, a follow-up will flip the default and
// retire the iframe + the /public/ HTML file.
//
// v1 scope: the spiral itself + interactions (drag, wheel, click).
// Deferred to a follow-up:
//   - bottom sheet with the tapped day's events
//   - filter chips (huddle / market / group / etc.)
//   - starfield background
//   - moon phases, season tints, month arcs
// Those are real design decisions (which mock data carries over,
// which lives in native Kronk primitives instead) that don't need
// to muddle the port itself.
//
// Animation lives in an imperative `useEffect` — a RAF loop that
// writes `transform / opacity / width / height` to cell DOM refs
// directly, without going through React reconciliation. React JSX
// only owns the container + stage structure; the ~140-cell pool is
// created + torn down in the effect.

import { useEffect, useRef } from 'react';

// ── Geometry constants (mirror the HTML prototype). ─────────────
// Only RIM + CELL are runtime-computed (via computeGeometry below);
// everything else is dimensionless / structural.
const DAY = 86400000;
const HEAD_ANGLE = -Math.PI / 2; // read head at 12 o'clock
const GROWTH_PER_TURN = 2.6;
const AHEAD = 132; // pooled cells drawn ahead of the head
const BEHIND = 8; // pooled cells still looming past the rim
const TURN_DAYS = 14.765; // half a lunation — one full turn of the spiral

interface Cell {
  el: HTMLDivElement;
  offset: number;
  n: number | null;
  dt: Date | null;
  num: HTMLSpanElement;
  mon: HTMLSpanElement;
  shown: boolean;
}

export const KalendarSpiral: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const stage = stageRef.current;
    const field = fieldRef.current;
    if (!container || !stage || !field) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayFrom = (n: number) => new Date(today.getTime() + n * DAY);

    // ── Responsive geometry via ResizeObserver on the mount point ─
    // Not window.innerWidth — that was the whole iframe problem.
    // The observer fires on layout changes (column resize, keyboard
    // open on mobile, etc.), the RAF loop reads the current values
    // every frame, so a resize flows through smoothly.
    let RIM = 200;
    let CELL = 59;
    const step = () => (2 * Math.PI) / TURN_DAYS;
    const k = () => Math.log(GROWTH_PER_TURN) / (2 * Math.PI);
    const ks = () => k() * step();

    const computeGeometry = () => {
      const rect = container.getBoundingClientRect();
      const raw = Math.min(rect.width * 0.3, rect.height * 0.28);
      RIM = Math.round(Math.max(160, Math.min(320, raw)));
      CELL = Math.round(RIM * 0.295);
    };
    computeGeometry();
    const ro = new ResizeObserver(computeGeometry);
    ro.observe(container);

    // ── Cell pool ─────────────────────────────────────────────────
    // Created once, reused across positions as the spiral spins.
    // `offset` is the cell's fixed slot relative to the current head
    // (rebind() maps `base + offset` to the real day index each time
    // the head crosses a day boundary).
    const cells: Cell[] = [];
    for (let o = -BEHIND; o <= AHEAD; o++) {
      const el = document.createElement('div');
      el.className = 'kspiral__day';
      const num = document.createElement('span');
      num.className = 'kspiral__num';
      const mon = document.createElement('span');
      mon.className = 'kspiral__mon';
      el.appendChild(num);
      el.appendChild(mon);
      field.appendChild(el);
      cells.push({ el, offset: o, n: null, dt: null, num, mon, shown: true });
    }

    let base = 0;
    const bindCell = (c: Cell, n: number) => {
      if (c.n === n) return;
      c.n = n;
      const dt = dayFrom(n);
      c.dt = dt;
      c.num.textContent = String(dt.getDate());
      c.mon.textContent = dt.toLocaleString('en', { month: 'short' });
      c.el.classList.toggle('kspiral__day--edge', dt.getDate() === 1);
      c.el.classList.toggle('kspiral__day--today', n === 0);
      c.el.classList.toggle('kspiral__day--gone', n < 0);
    };
    const rebind = (force = false) => {
      const b = Math.round(state.travel);
      if (b === base && !force) return;
      base = b;
      cells.forEach((c) => {
        if (force) c.n = null;
        bindCell(c, base + c.offset);
      });
    };

    // ── Travel state ──────────────────────────────────────────────
    // `travel` is the fractional day index at the read-head. Drag /
    // wheel push `target`; RAF eases travel toward it. Click on a
    // tile launches a `spin` tween that overrides for its duration.
    const state = {
      travel: 0,
      target: 0,
      spin: null as {
        from: number;
        to: number;
        t0: number;
        dur: number;
      } | null,
    };

    // Force initial bind so day cells have content before first paint.
    rebind(true);

    // ── The layout loop ───────────────────────────────────────────
    let raf = 0;
    const layout = (now: number) => {
      if (state.spin) {
        const p = Math.min(1, (now - state.spin.t0) / state.spin.dur);
        const ease = 1 - Math.pow(1 - p, 3);
        state.travel =
          state.spin.from + (state.spin.to - state.spin.from) * ease;
        if (p >= 1) {
          state.travel = state.spin.to;
          state.target = state.spin.to;
          state.spin = null;
        }
      } else {
        state.travel += (state.target - state.travel) * 0.1;
        if (Math.abs(state.target - state.travel) < 0.001)
          state.travel = state.target;
      }
      rebind();

      const _ks = ks();
      const _step = step();
      const t = state.travel;

      cells.forEach((c) => {
        if (c.n === null || c.dt === null) return;
        const u = c.n - t;
        const f = Math.exp(-_ks * u);
        const r = RIM * f;
        const size = CELL * f;

        // Fade-out at the extremes: too-big (past the horizon) or
        // too-small (past the eye).
        if (size > CELL * 4.6 || size < 1.1) {
          if (c.shown) {
            c.el.style.opacity = '0';
            c.el.style.pointerEvents = 'none';
            c.shown = false;
          }
          return;
        }
        c.shown = true;

        const a = HEAD_ANGLE - _step * u;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;

        let op = 1;
        if (size > CELL * 1.75)
          op = Math.max(0, (CELL * 4.6 - size) / (CELL * 2.85));
        if (size < 9) op = Math.max(0, (size - 1.1) / 7.9);

        // Tiny tiles collapse to a dot for the outer spiral texture.
        const tiny = size < 16 && c.dt.getDate() !== 1;
        const rendered = tiny ? Math.max(1.8, size * 0.24) : size;

        const s = c.el.style;
        s.width = `${rendered.toFixed(1)}px`;
        s.height = `${rendered.toFixed(1)}px`;
        s.fontSize = `${(size * 0.4).toFixed(1)}px`;
        s.opacity = op.toFixed(3);
        s.pointerEvents = size > 13 ? 'auto' : 'none';
        s.zIndex = String(4000 - Math.round(u * 6));
        s.transform = `translate(-50%,-50%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
        s.borderRadius = size < 18 ? '50%' : '';
        s.borderWidth = tiny ? '0' : '1px';

        c.num.style.display = size > 26 ? '' : 'none';
        c.mon.style.display =
          size > 54 || (size > 26 && c.dt.getDate() === 1) ? '' : 'none';
        c.el.classList.toggle(
          'kspiral__day--head',
          Math.abs(c.n - Math.round(t)) < 0.5,
        );
      });

      raf = requestAnimationFrame(layout);
    };
    raf = requestAnimationFrame(layout);

    // ── Interactions: drag (mouse + touch), wheel, tile click ─────
    let drag: { y: number; t: number; moved: boolean } | null = null;
    const onPointerDown = (e: PointerEvent) => {
      drag = { y: e.clientY, t: state.target, moved: false };
      stage.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!drag) return;
      const dy = drag.y - e.clientY;
      if (Math.abs(dy) > 3) {
        drag.moved = true;
        state.spin = null;
      }
      if (drag.moved) state.target = drag.t + dy * 0.055;
    };
    const onPointerUp = () => {
      drag = null;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      state.spin = null;
      state.target += e.deltaY * 0.022;
    };
    // Click on a tile → tween the head to that day's index.
    const onClick = (e: MouseEvent) => {
      if (drag?.moved) return; // ignore drag-releases
      const target = (e.target as HTMLElement).closest('.kspiral__day');
      if (!target) return;
      const cell = cells.find((c) => c.el === target);
      if (cell?.n == null) return;
      const dist = Math.abs(cell.n - state.travel);
      state.spin = {
        from: state.travel,
        to: cell.n,
        t0: performance.now(),
        dur: Math.min(1100, 260 + Math.sqrt(dist) * 130),
      };
      state.target = cell.n;
    };

    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerup', onPointerUp);
    stage.addEventListener('pointercancel', onPointerUp);
    stage.addEventListener('wheel', onWheel, { passive: false });
    stage.addEventListener('click', onClick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      stage.removeEventListener('pointerdown', onPointerDown);
      stage.removeEventListener('pointermove', onPointerMove);
      stage.removeEventListener('pointerup', onPointerUp);
      stage.removeEventListener('pointercancel', onPointerUp);
      stage.removeEventListener('wheel', onWheel);
      stage.removeEventListener('click', onClick);
      cells.forEach((c) => {
        c.el.remove();
      });
    };
  }, []);

  return (
    <div ref={containerRef} className='kspiral'>
      <div ref={stageRef} className='kspiral__stage'>
        <div ref={fieldRef} className='kspiral__field' />
      </div>
    </div>
  );
};
