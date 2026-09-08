// KalendarSpiral — React port of the /kalendar-spiral-preview.html
// prototype. Since #1746 this is the default face at /hub/kalendar.
//
// This component owns: the spiral geometry, the imperative RAF loop,
// drag / wheel / click interactions, and the two overlays that ride on
// top of it — the today-date badge (top-left) and the DayDetailsSheet
// that opens when a tile is tapped.
//
// Animation lives in an imperative `useEffect` — a RAF loop that
// writes `transform / opacity / width / height` to cell DOM refs
// directly, without going through React reconciliation. React JSX
// only owns the container, the overlays, and the sheet mount; the
// ~140-cell pool is created + torn down in the effect.
//
// Tile-glyph layer: every cell has a per-cell `.kspiral__day__marker`
// child element. `bindCell()` looks up the day's marker (an event, a
// birthday, an equinox/solstice, or a moon phase) and sets its
// className; the RAF loop hides the marker on tiny tiles the same way
// it hides the day number.
//
// Both marker data sources arrive asynchronously, and `bindCell` skips a
// cell whose day hasn't changed — so a fetch that lands after the first
// paint would leave every tile bound without its glyph until the spiral
// happened to move far enough to rebind it. `rebindRef` exists for that:
// data lands, the pool is re-bound in place.

import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiRequestGet } from 'mastodon/api';

import type { SeasonalMarker } from './astronomy';
import { moonPhase, seasonalMarker } from './astronomy';
import type { BirthdayEntry } from './day_details_sheet';
import { DayDetailsSheet } from './day_details_sheet';

// ── Geometry constants (mirror the HTML prototype). ─────────────
// Only RIM + CELL are runtime-computed (via computeGeometry below);
// everything else is dimensionless / structural.
const DAY = 86400000;
const HEAD_ANGLE = -Math.PI / 2; // read head at 12 o'clock
const GROWTH_PER_TURN = 2.6;
const AHEAD = 132; // pooled cells drawn ahead of the head
const BEHIND = 8; // pooled cells still looming past the rim
const TURN_DAYS = 14.765; // half a lunation — one full turn of the spiral

type MarkerKind =
  | 'moon-new'
  | 'moon-full'
  | 'equinox'
  | 'solstice'
  | 'birthday'
  | 'event';

// Only the start time is needed here — the tile is a "something happens
// on this day" glyph, and the day sheet fetches the detail when tapped.
interface EventDay {
  start_time: string;
}

const seasonalToMarker = (s: SeasonalMarker): MarkerKind =>
  s === 'march-equinox' || s === 'september-equinox' ? 'equinox' : 'solstice';

interface Cell {
  el: HTMLDivElement;
  offset: number;
  n: number | null;
  dt: Date | null;
  num: HTMLSpanElement;
  mon: HTMLSpanElement;
  marker: HTMLSpanElement;
  shown: boolean;
}

const messages = defineMessages({
  todayLabel: {
    id: 'kalendar.spiral.today',
    defaultMessage: 'Today',
  },
  recenterTitle: {
    id: 'kalendar.spiral.recenter',
    defaultMessage: 'Return to today',
  },
});

// Date → local-day ISO string (YYYY-MM-DD). Matches what the
// birthdays API returns for its `date` field.
const isoLocal = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const KalendarSpiral: React.FC = () => {
  const intl = useIntl();
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);

  // Lifted to React state: the tapped-day sheet.
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Birthdays keyed by local ISO date, so bindCell() can O(1) look up
  // whether a given tile should carry a birthday glyph.
  const [birthdays, setBirthdays] = useState<BirthdayEntry[]>([]);
  const birthdayIndexRef = useRef<Set<string>>(new Set());

  // Days carrying an event the viewer can see, keyed the same way.
  const eventIndexRef = useRef<Set<string>>(new Set());

  // Set by the RAF effect so async data can force the pooled cells to
  // re-read their markers without tearing the whole spiral down.
  const rebindRef = useRef<(force?: boolean) => void>(() => undefined);

  // Imperative handle populated by the RAF effect. Any React callback
  // (today-badge click, keyboard shortcuts, future toolbar buttons)
  // can call `spinToRef.current(dayIndex)` to tween the head there
  // — same shape as the tile-click tween.
  const spinToRef = useRef<(day: number) => void>(() => undefined);

  useEffect(() => {
    let cancelled = false;
    void apiRequestGet<BirthdayEntry[]>('v1/kalendar/birthdays')
      .then((data) => {
        if (cancelled) return;
        setBirthdays(data);
        birthdayIndexRef.current = new Set(data.map((b) => b.date));
        rebindRef.current(true);
        return undefined;
      })
      .catch(() => {
        // Non-blocking — a birthdays-API 401/500 shouldn't kill the spiral.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Events. Same source the day sheet reads, so a tile that carries a glyph
  // and the sheet that opens from it can never disagree about whether the day
  // has anything on it.
  //
  // Two limits worth knowing, both inherited from that endpoint: it returns
  // the 40 nearest upcoming events, and `upcoming` means start_time in the
  // future — so an event earlier today leaves today unmarked.
  useEffect(() => {
    let cancelled = false;
    void apiRequestGet<EventDay[]>('v1/events', { filter: 'upcoming' })
      .then((data) => {
        if (cancelled) return;
        eventIndexRef.current = new Set(
          data.map((e) => isoLocal(new Date(e.start_time))),
        );
        rebindRef.current(true);
        return undefined;
      })
      .catch(() => {
        // Non-blocking, same as birthdays.
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      const marker = document.createElement('span');
      marker.className = 'kspiral__marker';
      el.appendChild(num);
      el.appendChild(mon);
      el.appendChild(marker);
      field.appendChild(el);
      cells.push({
        el,
        offset: o,
        n: null,
        dt: null,
        num,
        mon,
        marker,
        shown: true,
      });
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

      // Marker: pick one, in this precedence order (only one glyph
      // per tile — the spiral is dense enough that stacking gets
      // noisy). An event outranks a birthday, and both outrank the sky:
      // an event is the thing you might have to be somewhere for.
      const iso = isoLocal(dt);
      let marker: MarkerKind | null = null;
      if (eventIndexRef.current.has(iso)) marker = 'event';
      else if (birthdayIndexRef.current.has(iso)) marker = 'birthday';
      else {
        const seasonal = seasonalMarker(dt);
        if (seasonal) marker = seasonalToMarker(seasonal);
        else {
          const moon = moonPhase(dt);
          if (moon === 'new') marker = 'moon-new';
          else if (moon === 'full') marker = 'moon-full';
        }
      }
      c.marker.className = marker
        ? `kspiral__marker kspiral__marker--${marker}`
        : 'kspiral__marker';
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

    // Hand the pool's rebind out, so the events / birthdays fetches can make
    // their glyphs appear the moment they land rather than the next time the
    // spiral is dragged far enough to recycle a tile.
    rebindRef.current = rebind;

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

    // Populate the imperative spin handle. `dist` mirrors the tile-click
    // tween's duration curve so a recenter from the outer spiral takes
    // the same feel as tapping the same day.
    spinToRef.current = (day: number) => {
      const dist = Math.abs(day - state.travel);
      state.spin = {
        from: state.travel,
        to: day,
        t0: performance.now(),
        dur: Math.min(1100, 260 + Math.sqrt(dist) * 130),
      };
      state.target = day;
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
        // Marker glyphs read at ~small text — hide on tiny tiles so
        // the outer spiral stays clean.
        c.marker.style.display = size > 26 ? '' : 'none';
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
    // Click on a tile → tween the head to that day's index AND open
    // the day-details sheet. The tween is imperative (state.spin);
    // the sheet is React state (setSelectedDate).
    const onClick = (e: MouseEvent) => {
      if (drag?.moved) return; // ignore drag-releases
      const target = (e.target as HTMLElement).closest('.kspiral__day');
      if (!target) return;
      const cell = cells.find((c) => c.el === target);
      if (cell?.n == null || cell.dt == null) return;
      const dist = Math.abs(cell.n - state.travel);
      state.spin = {
        from: state.travel,
        to: cell.n,
        t0: performance.now(),
        dur: Math.min(1100, 260 + Math.sqrt(dist) * 130),
      };
      state.target = cell.n;
      setSelectedDate(cell.dt);
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
      // A late fetch must not rebind a pool that no longer exists.
      rebindRef.current = () => undefined;
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

  const handleCloseSheet = useCallback(() => {
    setSelectedDate(null);
  }, []);

  const handleRecenter = useCallback(() => {
    spinToRef.current(0);
  }, []);

  const today = new Date();
  const todayNumber = intl.formatDate(today, { day: 'numeric' });
  const todayMonth = intl.formatDate(today, { month: 'short' });
  const todayWeekday = intl.formatDate(today, { weekday: 'short' });
  const todayLabel = intl.formatMessage(messages.todayLabel);
  const recenterTitle = intl.formatMessage(messages.recenterTitle);

  return (
    <div ref={containerRef} className='kspiral'>
      <button
        type='button'
        className='kspiral__today'
        onClick={handleRecenter}
        title={recenterTitle}
        aria-label={`${todayLabel} — ${intl.formatDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}. ${recenterTitle}`}
      >
        <span className='kspiral__today-weekday'>{todayWeekday}</span>
        <span className='kspiral__today-day'>{todayNumber}</span>
        <span className='kspiral__today-month'>{todayMonth}</span>
      </button>
      <div ref={stageRef} className='kspiral__stage'>
        <div ref={fieldRef} className='kspiral__field' />
      </div>
      {selectedDate && (
        <DayDetailsSheet
          date={selectedDate}
          birthdays={birthdays}
          onClose={handleCloseSheet}
        />
      )}
    </div>
  );
};
