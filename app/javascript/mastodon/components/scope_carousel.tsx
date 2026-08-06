import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useDrag } from '@use-gesture/react';

import { IconButton } from '@/mastodon/components/icon_button';
import ChevronLeftIcon from '@/material-icons/400-24px/chevron_left.svg?react';
import ChevronRightIcon from '@/material-icons/400-24px/chevron_right.svg?react';

// ScopeCarousel — the shared "rotating stand" scope selector (the "Prism").
//
// One vertical axis, a barrel of equal faces turned in true CSS-3D: each face
// sits at `rotateY(i*step) translateZ(radius)`, the barrel rotates as one body,
// and cylindrical shading (a darkening veil + a leading-edge sheen) keyed to
// each face's angle from front sells it as a solid turning object. A "pool of
// light" under the barrel tracks the front face; a ground shadow squashes as it
// turns.
//
// This is the isolated primitive: a single controlled selector, LARGE (feed
// view) or SMALL (compose reach). It owns no side effects — `onChange(key)`
// fires when a face settles to the front. Feed/compose wiring, the krew
// sub-picker, and the synced feed "deck" are follow-ups.
//
// Ported from the approved "Prism" prototype; see docs/kronk_scope_carousel.md.

const messages = defineMessages({
  prev: { id: 'scope_carousel.previous', defaultMessage: 'Previous' },
  next: { id: 'scope_carousel.next', defaultMessage: 'Next' },
});

export type MarkKind = 'self' | 'mates' | 'orbit' | 'kronk' | 'krews';

export interface ScopeFace {
  key: string;
  label: string;
  desc?: string;
  count?: string;
  mark?: MarkKind;
}

interface ScopeCarouselProps {
  faces: ScopeFace[];
  value: string;
  onChange: (key: string) => void;
  size?: 'large' | 'small' | 'mini';
  ariaLabel: string;
}

// Concentric-ring marks — one glyph per scope tier, reading as a distance
// ladder (a tight self dot out to Kronk's wide ring). Ported from the
// prototype's mark() helper.
const Mark: React.FC<{ kind: MarkKind; size: number }> = ({ kind, size }) => {
  const c = size / 2;
  const bright = 'var(--kronk-purple-bright)';
  const mid = 'var(--kronk-purple-muted)';
  const dim = 'var(--text-muted)';
  const rings: React.ReactNode[] = [];

  const ring = (r: number, col: string, dash?: string, w = 1.25) => (
    <circle
      key={`r${rings.length}`}
      cx={c}
      cy={c}
      r={r}
      fill='none'
      stroke={col}
      strokeWidth={w}
      strokeDasharray={dash}
    />
  );
  const dot = (r: number, col: string) => (
    <circle key={`d${rings.length}`} cx={c} cy={c} r={r} fill={col} />
  );

  if (kind === 'self') {
    rings.push(dot(size * 0.1, bright), ring(size * 0.22, dim, '1 4'));
  } else if (kind === 'mates') {
    rings.push(
      dot(size * 0.09, bright),
      ring(size * 0.24, bright),
      ring(size * 0.4, dim, '1 5'),
    );
  } else if (kind === 'orbit') {
    rings.push(
      dot(size * 0.08, mid),
      ring(size * 0.2, mid),
      ring(size * 0.32, bright),
      ring(size * 0.44, dim, '1 5'),
    );
  } else if (kind === 'kronk') {
    rings.push(
      dot(size * 0.07, mid),
      ring(size * 0.18, mid),
      ring(size * 0.29, mid),
      ring(size * 0.42, bright, undefined, 1.6),
    );
  } else {
    // krews — three interlinked rings around a hub
    const r = size * 0.115;
    const d = size * 0.2;
    rings.push(
      <circle
        key='k1'
        cx={c}
        cy={c - d}
        r={r}
        fill='none'
        stroke={bright}
        strokeWidth={1.4}
      />,
      <circle
        key='k2'
        cx={c - d * 0.92}
        cy={c + d * 0.62}
        r={r}
        fill='none'
        stroke={bright}
        strokeWidth={1.4}
      />,
      <circle
        key='k3'
        cx={c + d * 0.92}
        cy={c + d * 0.62}
        r={r}
        fill='none'
        stroke={mid}
        strokeWidth={1.4}
      />,
      <circle key='k4' cx={c} cy={c} r={size * 0.03} fill={dim} />,
    );
  }

  return (
    <svg
      className='scope-carousel__mark'
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden='true'
    >
      {rings}
    </svg>
  );
};

const norm = (i: number, n: number) => ((i % n) + n) % n;

export const ScopeCarousel: React.FC<ScopeCarouselProps> = ({
  faces,
  value,
  onChange,
  size = 'large',
  ariaLabel,
}) => {
  const intl = useIntl();
  const n = faces.length;
  const step = n > 0 ? 360 / n : 360;
  const markSize = size === 'large' ? 62 : size === 'mini' ? 30 : 34;

  const stageRef = useRef<HTMLDivElement>(null);
  const barrelRef = useRef<HTMLDivElement>(null);
  const poolRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLElement>(null);
  const faceRefs = useRef<(HTMLDivElement | null)[]>([]);
  const liveRef = useRef<HTMLDivElement>(null);

  // `index` is the committed front face (can exceed n; norm() maps it). It is a
  // ref, not state: the barrel is driven imperatively (like the prototype) so a
  // drag doesn't re-render per frame. React only re-renders when `faces`/`value`
  // change; onChange notifies the controlled parent.
  const indexRef = useRef(0);
  const radiusRef = useRef(0);
  const draggingRef = useRef(false);
  const dragDegRef = useRef(0);

  const degPerPx = useCallback(() => {
    const w = stageRef.current?.clientWidth ?? 1;
    return step / Math.max(w * 0.4, 1);
  }, [step]);

  // Write the whole barrel + shading + wire + shadow for a given rotation.
  // `animate` toggles the CSS transition (off during a live drag, on when a
  // face settles). Mirrors the prototype's render().
  const paint = useCallback(
    (animate: boolean) => {
      const barrel = barrelRef.current;
      if (!barrel) return;
      const rot =
        -(indexRef.current * step) +
        (draggingRef.current ? dragDegRef.current : 0);
      const radius = radiusRef.current;

      barrel.classList.toggle('no-anim', !animate);
      barrel.style.transform = `translateZ(${-radius}px) rotateY(${rot}deg)`;

      faceRefs.current.forEach((el, i) => {
        if (!el) return;
        let a = (i * step + rot) % 360;
        a = ((a % 360) + 360) % 360;
        if (a > 180) a -= 360;
        const t = Math.min(Math.abs(a) / 90, 1);
        const veil = el.querySelector<HTMLElement>('.scope-carousel__veil');
        const sheen = el.querySelector<HTMLElement>('.scope-carousel__sheen');
        const trans = animate
          ? 'opacity var(--sc-dur-turn) var(--sc-ease-turn)'
          : 'none';
        if (veil) {
          veil.style.transition = trans;
          veil.style.opacity = (t * 0.7).toFixed(3);
        }
        if (sheen) {
          sheen.style.transition = trans;
          sheen.style.opacity = (Math.sin((a * Math.PI) / 180) * 0.9).toFixed(
            3,
          );
        }
        const front = Math.abs(a) < step / 2;
        el.classList.toggle('is-front', front);
        el.setAttribute('aria-checked', front ? 'true' : 'false');
        el.tabIndex = front ? 0 : -1;
      });

      const shadow = shadowRef.current;
      if (shadow) {
        const sq = Math.abs(Math.sin((rot * Math.PI) / 180));
        shadow.style.transition = animate ? '' : 'none';
        shadow.style.transform = `scaleX(${(1 - sq * 0.22).toFixed(3)})`;
        shadow.style.opacity = (1 - sq * 0.35).toFixed(3);
      }

      const pool = poolRef.current;
      const stage = stageRef.current;
      if (pool && stage) {
        const w = stage.clientWidth;
        const pad = w * 0.1;
        const span = w - pad * 2;
        let slotF = -rot / step;
        slotF = ((slotF % n) + n) % n;
        if (slotF > n - 0.5) slotF -= n;
        const x =
          pad +
          span *
            (n === 1 ? 0.5 : Math.max(0, Math.min(n - 1, slotF)) / (n - 1));
        pool.style.transition = animate
          ? 'left var(--sc-dur-turn) var(--sc-ease-turn)'
          : 'none';
        pool.style.left = `${x}px`;
      }
    },
    [n, step],
  );

  // Position the faces around the barrel and size the radius to the stage
  // width. Re-runs on resize.
  const layout = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || n === 0) return;
    radiusRef.current = stage.clientWidth / 2 / Math.tan(Math.PI / n);
    faceRefs.current.forEach((el, i) => {
      if (el)
        el.style.transform = `rotateY(${i * step}deg) translateZ(${radiusRef.current}px)`;
    });
    paint(false);
    // let the no-anim frame commit, then re-enable transitions
    requestAnimationFrame(() => barrelRef.current?.classList.remove('no-anim'));
  }, [n, step, paint]);

  useLayoutEffect(() => {
    layout();
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', layout);
      return () => {
        window.removeEventListener('resize', layout);
      };
    }
    const ro = new ResizeObserver(layout);
    ro.observe(stage);
    return () => {
      ro.disconnect();
    };
  }, [layout]);

  // Commit to a face index, animate the turn, and announce it.
  const go = useCallback(
    (i: number, notify = true) => {
      indexRef.current = i;
      draggingRef.current = false;
      dragDegRef.current = 0;
      paint(true);
      const face = faces[norm(i, n)];
      if (face && liveRef.current) liveRef.current.textContent = face.label;
      if (notify && face && face.key !== value) onChange(face.key);
    },
    [faces, n, paint, onChange, value],
  );

  // Sync committed index to the controlled `value` (no onChange — parent-driven).
  useEffect(() => {
    if (n === 0) return;
    const target = faces.findIndex((f) => f.key === value);
    if (target < 0) return;
    // move to the nearest rotation showing `target`
    const cur = norm(indexRef.current, n);
    let diff = target - cur;
    if (diff > n / 2) diff -= n;
    if (diff < -n / 2) diff += n;
    if (diff !== 0 || norm(indexRef.current, n) !== target) {
      go(indexRef.current + diff, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, n]);

  const nudge = useCallback(
    (d: number) => {
      go(indexRef.current + d);
    },
    [go],
  );

  const handlePrev = useCallback(() => {
    nudge(-1);
  }, [nudge]);
  const handleNext = useCallback(() => {
    nudge(1);
  }, [nudge]);

  const bind = useDrag(
    ({ down, movement: [mx], velocity: [vx], direction: [dx], last }) => {
      if (down) {
        draggingRef.current = true;
        dragDegRef.current = mx * degPerPx();
        paint(false);
      } else if (last) {
        const turned = mx * degPerPx();
        const flick = vx * dx * 140 * degPerPx(); // inertia (velocity is unsigned)
        const snapped = -Math.round((turned + flick) / step);
        if (Math.abs(mx) > 4) go(indexRef.current + snapped);
        else {
          draggingRef.current = false;
          dragDegRef.current = 0;
          paint(true);
        }
      }
    },
    { axis: 'x', filterTaps: true, pointer: { touch: true } },
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        nudge(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nudge(1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        go(indexRef.current - norm(indexRef.current, n));
      } else if (e.key === 'End') {
        e.preventDefault();
        go(indexRef.current - norm(indexRef.current, n) + (n - 1));
      }
    },
    [nudge, go, n],
  );

  // Click a non-front face to bring it forward.
  const onFaceClick = useCallback(
    (i: number) => {
      const cur = norm(indexRef.current, n);
      let diff = i - cur;
      if (diff > n / 2) diff -= n;
      if (diff < -n / 2) diff += n;
      if (diff !== 0) go(indexRef.current + diff);
    },
    [go, n],
  );

  const handleFaceClick = useCallback(
    (
      e: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>,
    ) => {
      const idx = Number(e.currentTarget.dataset.index);
      if (!Number.isNaN(idx)) onFaceClick(idx);
    },
    [onFaceClick],
  );

  const handleFaceKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleFaceClick(e);
      }
    },
    [handleFaceClick],
  );

  const setFaceRef = useMemo(
    () => (i: number) => (el: HTMLDivElement | null) => {
      faceRefs.current[i] = el;
    },
    [],
  );

  return (
    <div className={`scope-carousel scope-carousel--${size}`}>
      <div className='scope-carousel__rotor'>
        <IconButton
          className='scope-carousel__arrow'
          icon='chevron-left'
          iconComponent={ChevronLeftIcon}
          title={intl.formatMessage(messages.prev)}
          onClick={handlePrev}
        />
        <div
          ref={stageRef}
          className='scope-carousel__stage'
          role='radiogroup'
          aria-label={ariaLabel}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          {...bind()}
        >
          <div ref={barrelRef} className='scope-carousel__barrel'>
            {faces.map((f, i) => (
              <div
                key={f.key}
                ref={setFaceRef(i)}
                data-index={i}
                className='scope-carousel__face'
                role='radio'
                aria-checked='false'
                aria-label={f.label}
                tabIndex={-1}
                onClick={handleFaceClick}
                onKeyDown={handleFaceKeyDown}
              >
                <div className='scope-carousel__veil' />
                <div className='scope-carousel__sheen' />
                {f.mark && <Mark kind={f.mark} size={markSize} />}
                <div className='scope-carousel__copy'>
                  <div className='scope-carousel__name'>{f.label}</div>
                  {f.desc && (
                    <div className='scope-carousel__desc'>{f.desc}</div>
                  )}
                  {f.count && (
                    <div className='scope-carousel__count'>{f.count}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <IconButton
          className='scope-carousel__arrow'
          icon='chevron-right'
          iconComponent={ChevronRightIcon}
          title={intl.formatMessage(messages.next)}
          onClick={handleNext}
        />
      </div>

      {/* Axis chrome (ground shadow + wire + pool) sells "a solid object on
          an axis". The mini variant drops it — that metaphor now lives on the
          revolving feed below, and mini must stay ~44px. */}
      {size !== 'mini' && (
        <>
          <div className='scope-carousel__groundshadow'>
            <i ref={shadowRef} />
          </div>
          <div className='scope-carousel__wire'>
            <div ref={poolRef} className='scope-carousel__pool' />
          </div>
        </>
      )}

      <div className='scope-carousel__live' aria-live='polite' ref={liveRef} />
    </div>
  );
};
