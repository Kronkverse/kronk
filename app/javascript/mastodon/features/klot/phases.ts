import { defineMessages } from 'react-intl';

import type { Phase } from 'mastodon/api/klot';

// Phase copy — the human-readable description surfaced next to the
// ring. Body/note taken verbatim from tides_prototype.html. Colors
// mirror the prototype's CSS custom properties so light-mode overrides
// can flow through the same names.

export const PHASE_ORDER: Phase[] = [
  'menstrual',
  'follicular',
  'ovulatory',
  'luteal',
];

interface PhaseCopy {
  name: string;
  tag: string;
  body: string;
  note?: string;
  colorVar: string; // CSS `var(--...)` expression
  moonName: string; // Circle view — "new moon" / "waxing" / etc.
  checkin: string;
}

export const PHASES: Record<Phase, PhaseCopy> = {
  menstrual: {
    name: 'Menstrual',
    tag: 'Rest & release',
    body: 'Bleeding begins as hormone levels bottom out. Energy often dips — a phase for rest, warmth, and gentleness. Cramps and fatigue are common and valid.',
    colorVar: 'var(--klot-menstrual)',
    moonName: 'New moon',
    checkin: 'A tender phase — a kind moment to check in.',
  },
  follicular: {
    name: 'Follicular',
    tag: 'Rising energy',
    body: 'Estrogen climbs as the body readies an egg. Energy, focus, and mood tend to lift — often the most social, creative stretch of the cycle.',
    colorVar: 'var(--klot-follicular)',
    moonName: 'Waxing',
    checkin: 'Rising energy — good for making plans together.',
  },
  ovulatory: {
    name: 'Ovulatory',
    tag: 'Peak',
    body: 'Estrogen peaks and an egg releases — the fertile window. Confidence and libido often crest. Some feel a brief one-sided twinge.',
    note: 'Phase estimates are a guide — not birth control or a fertility diagnosis.',
    colorVar: 'var(--klot-ovulatory)',
    moonName: 'Full moon',
    checkin: 'Peak energy — an outward, social stretch.',
  },
  luteal: {
    name: 'Luteal',
    tag: 'Winding down',
    body: "Progesterone rises, then falls if there's no pregnancy. Energy turns inward; PMS — mood shifts, cravings, tenderness — can surface in the days before bleeding.",
    colorVar: 'var(--klot-luteal)',
    moonName: 'Waning',
    checkin: "Energy's turning inward — a little extra patience helps.",
  },
};

// react-intl messages for anything visible in chrome (page title etc.).
export const klotMessages = defineMessages({
  title: { id: 'klot.title', defaultMessage: 'Klot' },
  lede: {
    id: 'klot.lede',
    defaultMessage: 'Track your cycle. Share the phase, not the data.',
  },
  tabMine: { id: 'klot.tab.mine', defaultMessage: 'My cycle' },
  tabCircle: { id: 'klot.tab.circle', defaultMessage: 'Circle' },
});
