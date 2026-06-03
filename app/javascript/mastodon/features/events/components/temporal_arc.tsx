import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { MoonPhaseName } from 'mastodon/features/events/components/celestial_calendar';
import { getMoonPhaseName } from 'mastodon/features/events/components/celestial_calendar';

const RADIUS = 600;
const H_ARC = 200;
const CENTER_Y = H_ARC - RADIUS; // -400 — circle center above viewport
const DEGREES_PER_DAY = 8;
const RAD = Math.PI / 180;
const SLOT_RANGE = 10;
const PX_PER_DAY = RADIUS * Math.sin(DEGREES_PER_DAY * RAD); // ~83.5

const MOON_PHASE_EMOJI: Record<MoonPhaseName, string> = {
  new_moon: '🌑',
  waxing_crescent: '🌒',
  first_quarter: '🌓',
  waxing_gibbous: '🌔',
  full_moon: '🌕',
  waning_gibbous: '🌖',
  last_quarter: '🌗',
  waning_crescent: '🌘',
};

function dayPosition(relIndex: number, cx: number): { x: number; y: number } {
  const theta = (180 - relIndex * DEGREES_PER_DAY) * RAD;
  return {
    x: cx + RADIUS * Math.sin(theta),
    y: CENTER_Y - RADIUS * Math.cos(theta),
  };
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

interface ArcEvent {
  id: string;
  start_time: string;
}

interface TemporalArcProps {
  events: ArcEvent[];
  onFocusDate: (date: Date) => void;
}

export const TemporalArc: React.FC<TemporalArcProps> = ({
  events,
  onFocusDate,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cx, setCx] = useState(187);
  const [wheelPos, setWheelPos] = useState(0);
  const dragActive = useRef(false);
  const dragStartX = useRef(0);
  const dragStartPos = useRef(0);
  const [renderTick, setRenderTick] = useState(0);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const focusedDay = Math.round(wheelPos);
  const focusedDate = useMemo(
    () => addDays(today, focusedDay),
    [today, focusedDay],
  );

  useEffect(() => {
    onFocusDate(focusedDate);
  }, [focusedDate, onFocusDate]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setCx(w / 2);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, []);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const ev of events) {
      const d = new Date(ev.start_time);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [events]);

  const snap = useCallback(() => {
    if (!dragActive.current) return;
    dragActive.current = false;
    setWheelPos((prev) => Math.round(prev));
    setRenderTick((n) => n + 1);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1 : -1;
    setWheelPos((prev) =>
      Math.max(-365, Math.min(365, Math.round(prev) + delta)),
    );
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      dragStartX.current = touch.clientX;
      dragStartPos.current = wheelPos;
      dragActive.current = true;
      setRenderTick((n) => n + 1);
    },
    [wheelPos],
  );

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragActive.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    const dx = touch.clientX - dragStartX.current;
    setWheelPos(
      Math.max(-365, Math.min(365, dragStartPos.current - dx / PX_PER_DAY)),
    );
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragStartX.current = e.clientX;
      dragStartPos.current = wheelPos;
      dragActive.current = true;
      setRenderTick((n) => n + 1);
    },
    [wheelPos],
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragActive.current) return;
    const dx = e.clientX - dragStartX.current;
    setWheelPos(
      Math.max(-365, Math.min(365, dragStartPos.current - dx / PX_PER_DAY)),
    );
  }, []);

  const dragging = dragActive.current;

  // renderTick is used only to trigger re-render when dragActive.current changes
  // (refs don't trigger renders on their own)
  void renderTick;

  const dayNodes = useMemo(() => {
    const nodes = [];
    for (let i = -SLOT_RANGE; i <= SLOT_RANGE; i++) {
      const relIndex = i - wheelPos;
      const { x, y } = dayPosition(relIndex, cx);
      if (y < -40) continue;

      const date = addDays(today, i);
      const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const phase = getMoonPhaseName(date);
      const moonEmoji = MOON_PHASE_EMOJI[phase];
      const eventCount = eventsByDate.get(dateKey) ?? 0;

      nodes.push({
        i,
        x,
        y,
        date,
        isToday: i === 0,
        isFocused: focusedDay === i,
        isPast: i < 0,
        moonEmoji,
        eventCount,
      });
    }
    return nodes;
  }, [wheelPos, cx, today, eventsByDate, focusedDay]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      setWheelPos((prev) => Math.min(365, Math.round(prev) + 1));
    } else if (e.key === 'ArrowLeft') {
      setWheelPos((prev) => Math.max(-365, Math.round(prev) - 1));
    }
  }, []);

  return (
    <div
      ref={containerRef}
      role='slider'
      aria-label='Date wheel — use arrow keys to navigate days'
      aria-valuenow={focusedDay}
      aria-valuemin={-365}
      aria-valuemax={365}
      tabIndex={0}
      className={`temporal-arc${dragging ? ' temporal-arc--dragging' : ''}`}
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={snap}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={snap}
      onMouseLeave={snap}
    >
      <svg className='temporal-arc__track' aria-hidden='true'>
        <circle
          cx={cx}
          cy={CENTER_Y}
          r={RADIUS}
          fill='none'
          stroke='currentColor'
          strokeOpacity={0.1}
          strokeWidth={1}
        />
      </svg>

      {dayNodes.map(
        ({
          i,
          x,
          y,
          date,
          isToday,
          isFocused,
          isPast,
          moonEmoji,
          eventCount,
        }) => (
          <div
            key={i}
            className={[
              'temporal-arc__day',
              isToday ? 'temporal-arc__day--today' : '',
              isFocused ? 'temporal-arc__day--focused' : '',
              isPast ? 'temporal-arc__day--past' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{
              left: x,
              top: y,
              transition: dragging ? 'none' : 'left 0.22s ease, top 0.22s ease',
            }}
            aria-label={date.toLocaleDateString('en-AU', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
          >
            <span className='temporal-arc__day-moon'>{moonEmoji}</span>
            <span className='temporal-arc__day-num'>{date.getDate()}</span>
            {eventCount > 0 && (
              <span
                className='temporal-arc__day-dot'
                aria-label={`${eventCount} event${eventCount > 1 ? 's' : ''}`}
              />
            )}
          </div>
        ),
      )}

      <div className='temporal-arc__needle' aria-hidden='true' />
    </div>
  );
};
