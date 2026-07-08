import { useId } from 'react';

import type { PhaseKey } from '../types';

interface Props {
  phase: PhaseKey;
  size?: number;
}

// Small inline moon glyph — matches the ring's per-phase iconography
// (new / waxing / full / waning). Used for the "they see" badge preview.
export const Moon: React.FC<Props> = ({ phase, size = 14 }) => {
  const maskId = useId();
  const r = size / 2 - 0.5;
  const cx = size / 2;
  const cy = size / 2;

  if (phase === 'ovulatory') {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill='#F3EFDA' />
      </svg>
    );
  }
  if (phase === 'menstrual') {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill='#F3EFDA' fillOpacity={0.1} />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill='none'
          stroke='#F3EFDA'
          strokeOpacity={0.5}
          strokeWidth={1}
        />
      </svg>
    );
  }

  const bx = cx + (phase === 'follicular' ? -1 : 1) * r * 0.55;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <mask id={maskId}>
        <circle cx={cx} cy={cy} r={r} fill='#fff' />
        <circle cx={bx} cy={cy} r={r} fill='#000' />
      </mask>
      <circle cx={cx} cy={cy} r={r} fill='#F3EFDA' mask={`url(#${maskId})`} />
    </svg>
  );
};
