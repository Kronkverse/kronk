import { useMemo } from 'react';

import type { PhaseKey } from '../types';
import { ranges, PHASE_COLORS } from '../phase_math';

const CX = 170;
const CY = 170;
const R = 125;

interface Props {
  cycleLength: number;
  periodLength: number;
  currentDay: number;
  currentPhase: PhaseKey;
  onInspect?: (day: number) => void;
}

function polar(t: number, cycleLength: number): [number, number] {
  const angle = ((-90 + (t / cycleLength) * 360) * Math.PI) / 180;
  return [CX + R * Math.cos(angle), CY + R * Math.sin(angle)];
}

function arcPath(t0: number, t1: number, cycleLength: number): string {
  const [x0, y0] = polar(t0, cycleLength);
  const [x1, y1] = polar(t1, cycleLength);
  const large = (t1 - t0) / cycleLength > 0.5 ? 1 : 0;
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${R} ${R} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}

// Moon glyph — full for ovulatory, ring outline for menstrual (new moon),
// waxing/waning crescents for follicular/luteal.
function Moon({
  cx,
  cy,
  r,
  phase,
  maskId,
}: {
  cx: number;
  cy: number;
  r: number;
  phase: PhaseKey;
  maskId: string;
}) {
  if (phase === 'ovulatory') {
    return <circle cx={cx} cy={cy} r={r} fill='#F3EFDA' />;
  }
  if (phase === 'menstrual') {
    return (
      <>
        <circle cx={cx} cy={cy} r={r} fill='#F3EFDA' fillOpacity={0.1} />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill='none'
          stroke='#F3EFDA'
          strokeOpacity={0.42}
          strokeWidth={1.3}
        />
      </>
    );
  }
  const bx = cx + (phase === 'follicular' ? -1 : 1) * r * 0.55;
  return (
    <>
      <mask id={maskId}>
        <circle cx={cx} cy={cy} r={r} fill='#fff' />
        <circle cx={bx} cy={cy} r={r} fill='#000' />
      </mask>
      <circle cx={cx} cy={cy} r={r} fill='#F3EFDA' mask={`url(#${maskId})`} />
    </>
  );
}

export const CycleRing: React.FC<Props> = ({
  cycleLength,
  periodLength,
  currentDay,
  currentPhase,
  onInspect,
}) => {
  const bands = useMemo(
    () => ranges(cycleLength, periodLength),
    [cycleLength, periodLength],
  );

  const orbPos = useMemo(
    () => polar(currentDay - 0.5, cycleLength),
    [currentDay, cycleLength],
  );

  const handleClick = onInspect
    ? (e: React.MouseEvent<SVGSVGElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const ang = (Math.atan2(py - cy, px - cx) * 180) / Math.PI;
        const f = ((((ang + 90) % 360) + 360) % 360) / 360;
        const day = Math.min(
          cycleLength,
          Math.max(1, Math.round(f * cycleLength) + 1),
        );
        onInspect(day);
      }
    : undefined;

  return (
    <svg
      className='klot-ring'
      viewBox='0 0 340 340'
      onClick={handleClick}
      role='img'
      aria-label='Cycle ring'
    >
      {bands.map((band) => {
        const dim = band.key !== currentPhase;
        const [mx, my] = polar((band.from - 1 + band.to) / 2, cycleLength);
        return (
          <g key={band.key}>
            <path
              d={arcPath(band.from - 1 + 0.35, band.to - 0.35, cycleLength)}
              stroke={PHASE_COLORS[band.key]}
              strokeWidth={11}
              strokeLinecap='round'
              fill='none'
              opacity={dim ? 0.32 : 0.9}
            />
            <Moon
              maskId={`klot-band-${band.key}`}
              cx={mx}
              cy={my}
              r={11}
              phase={band.key}
            />
          </g>
        );
      })}

      {/* Today / inspected orb */}
      <circle
        cx={orbPos[0].toFixed(1)}
        cy={orbPos[1].toFixed(1)}
        r={20}
        fill={PHASE_COLORS[currentPhase]}
        opacity={0.5}
        className='klot-ring__halo'
      />
      <circle
        cx={orbPos[0].toFixed(1)}
        cy={orbPos[1].toFixed(1)}
        r={13}
        fill='#0D0A1F'
        stroke={PHASE_COLORS[currentPhase]}
        strokeWidth={2}
      />
      <Moon
        maskId='klot-orb'
        cx={orbPos[0]}
        cy={orbPos[1]}
        r={8.5}
        phase={currentPhase}
      />
    </svg>
  );
};
