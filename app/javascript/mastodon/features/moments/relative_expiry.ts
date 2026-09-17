// Auto-scale a seconds delta into a sensible unit + rescaled value
// for `<FormattedRelativeTime>`. React-intl defaults to displaying
// raw seconds when no `unit` is passed, which reads as "Gone 342311
// seconds ago" on an expired Moment (Tal 2026-09-05). Scaling to
// minute / hour / day / month / year makes the Log actually
// readable.
//
// Works for both directions (positive = future, "gone in X"; negative
// = past, "gone X ago"). The unit thresholds match how humans think
// about the passage of time — "1 hour" once you're past 60 minutes,
// "1 day" once you're past 24 hours, and so on. Approximate months as
// 30 days and years as 365 days; the display uses these units with
// `numeric='auto'` so react-intl handles pluralisation + the
// direction copy ("2 hours ago", "in 3 days") per locale.
//
// Seconds-precision is deliberately absent: a Moment gone 45 seconds
// ago reads "1 minute ago", not "45 seconds ago". The moment before
// expiry is the only time seconds precision would matter and the
// clients that show this text (grid tile + viewer footer) refresh
// on the minute anyway.

export type RelativeExpiryUnit = 'minute' | 'hour' | 'day' | 'month' | 'year';

interface Scaled {
  value: number;
  unit: RelativeExpiryUnit;
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

// `seconds` may be positive (future) or negative (past). The returned
// value carries the same sign so `<FormattedRelativeTime>` renders
// the correct direction copy.
export const scaleRelativeExpiry = (seconds: number): Scaled => {
  const abs = Math.abs(seconds);
  const sign = seconds < 0 ? -1 : 1;

  if (abs < HOUR) {
    // Under an hour, always at least ±1 minute — avoids "0 minutes"
    // for the ~30-second slice around the crossover.
    const minutes = Math.max(1, Math.round(abs / MINUTE));
    return { value: sign * minutes, unit: 'minute' };
  }
  if (abs < DAY) return { value: Math.round(seconds / HOUR), unit: 'hour' };
  if (abs < MONTH) return { value: Math.round(seconds / DAY), unit: 'day' };
  if (abs < YEAR) return { value: Math.round(seconds / MONTH), unit: 'month' };
  return { value: Math.round(seconds / YEAR), unit: 'year' };
};
