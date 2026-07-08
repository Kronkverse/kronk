import type { PhaseKey } from './types';

// Mirror of app/lib/klot/phase.rb — keep in sync with backend if the
// range logic evolves. Client-side computation lets the ring re-render
// on setting changes without a server round-trip.

export interface PhaseBand {
  key: PhaseKey;
  from: number; // 1-indexed day of cycle, inclusive
  to: number;
}

export const PHASE_KEYS: PhaseKey[] = [
  'menstrual',
  'follicular',
  'ovulatory',
  'luteal',
];

export const PHASE_COLORS: Record<PhaseKey, string> = {
  menstrual: '#C25E7E',
  follicular: '#6E86E0',
  ovulatory: '#E6B25A',
  luteal: '#9578C9',
};

export const PHASE_NAMES: Record<PhaseKey, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulatory: 'Ovulatory',
  luteal: 'Luteal',
};

export const PHASE_TAGS: Record<PhaseKey, string> = {
  menstrual: 'Rest & release',
  follicular: 'Rising energy',
  ovulatory: 'Peak',
  luteal: 'Winding down',
};

export const PHASE_BODY: Record<PhaseKey, string> = {
  menstrual:
    'Bleeding begins as hormone levels bottom out. Energy often dips — a phase for rest, warmth, and gentleness. Cramps and fatigue are common and valid.',
  follicular:
    'Estrogen climbs as the body readies an egg. Energy, focus, and mood tend to lift — often the most social, creative stretch of the cycle.',
  ovulatory:
    'Estrogen peaks and an egg releases — the fertile window. Confidence and libido often crest. Some feel a brief one-sided twinge.',
  luteal:
    'Progesterone rises, then falls if there is no pregnancy. Energy turns inward; PMS — mood shifts, cravings, tenderness — can surface in the days before bleeding.',
};

export const PHASE_NOTE: Record<PhaseKey, string> = {
  menstrual: '',
  follicular: '',
  ovulatory: 'Phase estimates are a guide — not birth control or a fertility diagnosis.',
  luteal: '',
};

export function ranges(cycleLength: number, periodLength: number): PhaseBand[] {
  const ov = Math.max(periodLength + 3, cycleLength - 14);
  const a = ov - 1;
  const b = ov + 1;
  return [
    { key: 'menstrual',  from: 1,               to: periodLength },
    { key: 'follicular', from: periodLength + 1, to: a - 1 },
    { key: 'ovulatory',  from: a,               to: b },
    { key: 'luteal',     from: b + 1,           to: cycleLength },
  ];
}

export function phaseOf(
  day: number,
  cycleLength: number,
  periodLength: number,
): PhaseKey {
  for (const band of ranges(cycleLength, periodLength)) {
    if (day >= band.from && day <= band.to) return band.key;
  }
  return 'luteal';
}

// Days between two ISO dates (YYYY-MM-DD) as integers.
const MS_PER_DAY = 86_400_000;

export function dayOfCycle(
  lastStartIso: string | undefined,
  today: Date,
  cycleLength: number,
): number {
  if (!lastStartIso) return 1;
  const start = new Date(`${lastStartIso}T00:00:00`);
  const diff = Math.floor(
    (today.getTime() - start.getTime()) / MS_PER_DAY,
  );
  if (diff < 0) return 1;
  return (diff % cycleLength) + 1;
}

export function todayISO(now = new Date()): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
