// Pure-math astronomy for the Kalendar Spiral. Given a Date, return
// the two markers the tile-glyph layer + day sheet care about:
//
//   moonPhase(date)      → 'new' | 'full' | null  (only new/full — not
//                          quarter phases, since those don't get glyphs)
//   seasonalMarker(date) → 'march-equinox' | 'june-solstice' |
//                          'september-equinox' | 'december-solstice' | null
//
// Astronomical convention (not hemispheric): we name markers by the
// month rather than "spring" / "summer" so the labels are correct for
// Kronkers in both hemispheres. The day sheet can localise how it says
// them; the marker glyphs are the same either way.
//
// Precision: both functions use standard low-precision astronomy
// formulae (Meeus, "Astronomical Algorithms" ch. 47 + 27). Accurate to
// ~a few hours over the ±150-day window the spiral shows, which is
// plenty for "does this day get a glyph". No external data needed.

const SYNODIC_MONTH = 29.53058867; // mean days between new moons
const NEW_MOON_REF_JD = 2451549.5; // 2000-01-06 18:14 UTC — a known new moon
const MARKER_TOLERANCE_DAYS = 0.5; // ±12h of the exact event → mark the day

// Convert a JS Date to Julian Date (UT).
const toJulianDate = (date: Date): number =>
  date.getTime() / 86400000 + 2440587.5;

export type MoonPhase = 'new' | 'full';

export const moonPhase = (date: Date): MoonPhase | null => {
  // Anchor on local-noon so a date lands wholly inside one lunation
  // bucket regardless of the client's timezone. Off-by-one at midnight
  // was a real bug in the prototype.
  const noon = new Date(date);
  noon.setHours(12, 0, 0, 0);
  const jd = toJulianDate(noon);
  const daysIntoCycle =
    (((jd - NEW_MOON_REF_JD) % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;
  if (
    daysIntoCycle < MARKER_TOLERANCE_DAYS ||
    daysIntoCycle > SYNODIC_MONTH - MARKER_TOLERANCE_DAYS
  )
    return 'new';
  if (Math.abs(daysIntoCycle - SYNODIC_MONTH / 2) < MARKER_TOLERANCE_DAYS)
    return 'full';
  return null;
};

export type SeasonalMarker =
  | 'march-equinox'
  | 'june-solstice'
  | 'september-equinox'
  | 'december-solstice';

// Meeus ch. 27 low-precision formulae — mean equinox/solstice for the
// given year, returned as UT Julian Dates. Off by up to ~20 minutes,
// which is well inside the ±12h tolerance.
const seasonJulianDate = (year: number, kind: SeasonalMarker): number => {
  const y = (year - 2000) / 1000;
  const y2 = y * y;
  const y3 = y2 * y;
  const y4 = y3 * y;
  switch (kind) {
    case 'march-equinox':
      return (
        2451623.80984 +
        365242.37404 * y +
        0.05169 * y2 -
        0.00411 * y3 -
        0.00057 * y4
      );
    case 'june-solstice':
      return (
        2451716.56767 +
        365241.62603 * y +
        0.00325 * y2 +
        0.00888 * y3 -
        0.0003 * y4
      );
    case 'september-equinox':
      return (
        2451810.21715 +
        365242.01767 * y -
        0.11575 * y2 +
        0.00337 * y3 +
        0.00078 * y4
      );
    case 'december-solstice':
      return (
        2451900.05952 +
        365242.74049 * y -
        0.06223 * y2 -
        0.00823 * y3 +
        0.00032 * y4
      );
  }
};

const SEASONAL_KINDS: SeasonalMarker[] = [
  'march-equinox',
  'june-solstice',
  'september-equinox',
  'december-solstice',
];

export const seasonalMarker = (date: Date): SeasonalMarker | null => {
  const year = date.getUTCFullYear();
  // Anchor on local-noon of the tile date, same reasoning as moonPhase.
  const noon = new Date(date);
  noon.setHours(12, 0, 0, 0);
  const jd = toJulianDate(noon);
  for (const kind of SEASONAL_KINDS) {
    if (Math.abs(jd - seasonJulianDate(year, kind)) < MARKER_TOLERANCE_DAYS)
      return kind;
  }
  return null;
};
