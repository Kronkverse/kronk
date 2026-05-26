/**
 * celestial_calendar.ts
 * Pure-JS celestial date calculations — no external dependencies.
 * Covers: lunar phases, moon phase name, seasons (equinox/solstice),
 * solar terms, and Western astrology zodiac signs.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type MoonPhaseName =
  | 'new_moon'
  | 'waxing_crescent'
  | 'first_quarter'
  | 'waxing_gibbous'
  | 'full_moon'
  | 'waning_gibbous'
  | 'last_quarter'
  | 'waning_crescent';

export type SeasonName = 'spring' | 'summer' | 'autumn' | 'winter';

export type CelestialEvent =
  | { type: 'moon'; phase: MoonPhaseName; emoji: string; label: string }
  | { type: 'season'; season: SeasonName; emoji: string; label: string }
  | { type: 'zodiac'; sign: string; emoji: string; label: string };

// ─────────────────────────────────────────────────────────────────────────────
// Lunar phase calculation
// Uses the Julian Day Number method for accuracy.
// ─────────────────────────────────────────────────────────────────────────────

const LUNAR_CYCLE_DAYS = 29.53058867;

/** Convert a JS Date to a Julian Day Number */
function toJulianDay(date: Date): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d =
    date.getUTCDate() +
    date.getUTCHours() / 24 +
    date.getUTCMinutes() / 1440 +
    date.getUTCSeconds() / 86400;

  let Y = y;
  let M = m;
  if (M <= 2) {
    Y -= 1;
    M += 12;
  }
  const A = Math.floor(Y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + d + B - 1524.5;
}

/**
 * Returns moon age in days (0 = new moon, ~14.76 = full moon).
 * Reference new moon: 2000-01-06 18:14 UTC (JD 2451550.1)
 */
export function getMoonAge(date: Date): number {
  const jd = toJulianDay(date);
  const knownNewMoonJD = 2451550.1; // Jan 6 2000 new moon
  const daysSince = jd - knownNewMoonJD;
  const age = ((daysSince % LUNAR_CYCLE_DAYS) + LUNAR_CYCLE_DAYS) % LUNAR_CYCLE_DAYS;
  return age;
}

/** 0–1 illumination fraction */
export function getMoonIllumination(date: Date): number {
  const age = getMoonAge(date);
  return (1 - Math.cos((2 * Math.PI * age) / LUNAR_CYCLE_DAYS)) / 2;
}

export function getMoonPhaseName(date: Date): MoonPhaseName {
  const age = getMoonAge(date);
  const cycle = LUNAR_CYCLE_DAYS;

  if (age < 1.85 || age > cycle - 1.85) return 'new_moon';
  if (age < cycle * 0.25 - 1.85) return 'waxing_crescent';
  if (age < cycle * 0.25 + 1.85) return 'first_quarter';
  if (age < cycle * 0.5 - 1.85) return 'waxing_gibbous';
  if (age < cycle * 0.5 + 1.85) return 'full_moon';
  if (age < cycle * 0.75 - 1.85) return 'waning_gibbous';
  if (age < cycle * 0.75 + 1.85) return 'last_quarter';
  return 'waning_crescent';
}

const MOON_EMOJIS: Record<MoonPhaseName, string> = {
  new_moon: '🌑',
  waxing_crescent: '🌒',
  first_quarter: '🌓',
  waxing_gibbous: '🌔',
  full_moon: '🌕',
  waning_gibbous: '🌖',
  last_quarter: '🌗',
  waning_crescent: '🌘',
};

const MOON_LABELS: Record<MoonPhaseName, string> = {
  new_moon: 'New Moon',
  waxing_crescent: 'Waxing Crescent',
  first_quarter: 'First Quarter',
  waxing_gibbous: 'Waxing Gibbous',
  full_moon: 'Full Moon',
  waning_gibbous: 'Waning Gibbous',
  last_quarter: 'Last Quarter',
  waning_crescent: 'Waning Crescent',
};

/**
 * Returns the exact (±2 day) new/full moon dates in a given month.
 * Scans each day and watches for phase transitions.
 */
export function getMoonEventDatesForMonth(
  year: number,
  month: number, // 0-indexed
): Array<{ date: Date; phase: MoonPhaseName; emoji: string; label: string }> {
  const results: Array<{ date: Date; phase: MoonPhaseName; emoji: string; label: string }> = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Key phases we want to surface
  const keyPhases: MoonPhaseName[] = ['new_moon', 'first_quarter', 'full_moon', 'last_quarter'];
  let prevPhase: MoonPhaseName | null = null;

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d, 12, 0, 0);
    const phase = getMoonPhaseName(date);
    if (phase !== prevPhase && keyPhases.includes(phase)) {
      results.push({
        date,
        phase,
        emoji: MOON_EMOJIS[phase],
        label: MOON_LABELS[phase],
      });
    }
    prevPhase = phase;
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Seasons — equinoxes & solstices (Northern Hemisphere by default)
// Uses Jean Meeus "Astronomical Algorithms" mean date approximation.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns approximate Julian Day of a season start for a given year.
 * k: 0 = March equinox, 1 = June solstice, 2 = Sep equinox, 3 = Dec solstice
 */
function seasonJDE(year: number, k: 0 | 1 | 2 | 3): number {
  const Y = (year - 2000) / 1000;
  const tables: number[][] = [
    // Spring equinox
    [2451623.80984, 365242.37404, 0.05169, -0.00411, -0.00057],
    // Summer solstice
    [2451716.56767, 365241.62603, 0.00325, 0.00888, -0.00030],
    // Autumn equinox
    [2451810.21715, 365242.01767, -0.11575, 0.00337, 0.00078],
    // Winter solstice
    [2451900.05952, 365242.74049, -0.06223, -0.00823, 0.00032],
  ];
  const [J0, J1, J2, J3, J4] = tables[k];
  return J0 + J1 * Y + J2 * Y * Y + J3 * Y * Y * Y + J4 * Y * Y * Y * Y;
}

function julianDayToDate(jd: number): Date {
  const z = Math.floor(jd + 0.5);
  const f = jd + 0.5 - z;
  let A: number;
  if (z < 2299161) {
    A = z;
  } else {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    A = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);

  const day = B - D - Math.floor(30.6001 * E);
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;

  const hourFrac = f * 24;
  const hour = Math.floor(hourFrac);
  const min = Math.floor((hourFrac - hour) * 60);

  return new Date(Date.UTC(year, month - 1, day, hour, min));
}

export type SeasonEvent = {
  date: Date;
  season: SeasonName;
  label: string;
  emoji: string;
};

const SEASON_META: Array<{ season: SeasonName; label: string; emoji: string }> = [
  { season: 'spring', label: 'Spring Equinox', emoji: '🌸' },
  { season: 'summer', label: 'Summer Solstice', emoji: '☀️' },
  { season: 'autumn', label: 'Autumn Equinox', emoji: '🍂' },
  { season: 'winter', label: 'Winter Solstice', emoji: '❄️' },
];

export function getSeasonEventsForYear(year: number): SeasonEvent[] {
  return ([0, 1, 2, 3] as const).map((k) => {
    const jde = seasonJDE(year, k);
    const date = julianDayToDate(jde);
    const meta = SEASON_META[k];
    return { date, ...meta };
  });
}

export function getSeasonEventsForMonth(year: number, month: number): SeasonEvent[] {
  return getSeasonEventsForYear(year).filter((e) => e.date.getMonth() === month);
}

// ─────────────────────────────────────────────────────────────────────────────
// Zodiac signs — based on solar longitude (Western tropical astrology)
// ─────────────────────────────────────────────────────────────────────────────

export type ZodiacSign = {
  sign: string;
  emoji: string;
  startMonth: number; // 0-indexed
  startDay: number;
  endMonth: number;
  endDay: number;
};

const ZODIAC_SIGNS: ZodiacSign[] = [
  { sign: 'Aries', emoji: '♈', startMonth: 2, startDay: 21, endMonth: 3, endDay: 19 },
  { sign: 'Taurus', emoji: '♉', startMonth: 3, startDay: 20, endMonth: 4, endDay: 20 },
  { sign: 'Gemini', emoji: '♊', startMonth: 4, startDay: 21, endMonth: 5, endDay: 20 },
  { sign: 'Cancer', emoji: '♋', startMonth: 5, startDay: 21, endMonth: 6, endDay: 22 },
  { sign: 'Leo', emoji: '♌', startMonth: 6, startDay: 23, endMonth: 7, endDay: 22 },
  { sign: 'Virgo', emoji: '♍', startMonth: 7, startDay: 23, endMonth: 8, endDay: 22 },
  { sign: 'Libra', emoji: '♎', startMonth: 8, startDay: 23, endMonth: 9, endDay: 22 },
  { sign: 'Scorpio', emoji: '♏', startMonth: 9, startDay: 23, endMonth: 10, endDay: 21 },
  { sign: 'Sagittarius', emoji: '♐', startMonth: 10, startDay: 22, endMonth: 11, endDay: 21 },
  { sign: 'Capricorn', emoji: '♑', startMonth: 11, startDay: 22, endMonth: 0, endDay: 19 },
  { sign: 'Aquarius', emoji: '♒', startMonth: 0, startDay: 20, endMonth: 1, endDay: 18 },
  { sign: 'Pisces', emoji: '♓', startMonth: 1, startDay: 19, endMonth: 2, endDay: 20 },
];

export function getZodiacForDate(date: Date): ZodiacSign {
  const m = date.getMonth();
  const d = date.getDate();

  for (const z of ZODIAC_SIGNS) {
    // Same month start
    if (z.startMonth === m && d >= z.startDay) return z;
    // Same month end (if end month wraps or matches)
    if (z.endMonth === m && d <= z.endDay) return z;
  }
  // Fallback — shouldn't happen
  return ZODIAC_SIGNS[0];
}

/**
 * Returns zodiac sign transition dates for a given month
 * (days when a new sign begins).
 */
export function getZodiacTransitionsForMonth(
  year: number,
  month: number,
): Array<{ date: Date; sign: ZodiacSign }> {
  const results: Array<{ date: Date; sign: ZodiacSign }> = [];
  for (const z of ZODIAC_SIGNS) {
    if (z.startMonth === month) {
      results.push({ date: new Date(year, month, z.startDay), sign: z });
    }
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified: get all celestial events for a given month
// ─────────────────────────────────────────────────────────────────────────────

export type CelestialDayEvents = {
  moon?: { phase: MoonPhaseName; emoji: string; label: string };
  season?: { season: SeasonName; emoji: string; label: string };
  zodiac?: { sign: string; emoji: string; label: string };
};

/** Returns a Map<dateString, CelestialDayEvents> for the given month. */
export function getCelestialEventsForMonth(
  year: number,
  month: number,
): Map<string, CelestialDayEvents> {
  const map = new Map<string, CelestialDayEvents>();

  const ensure = (dateStr: string): CelestialDayEvents => {
    if (!map.has(dateStr)) map.set(dateStr, {});
    return map.get(dateStr)!;
  };

  // Moon events
  for (const m of getMoonEventDatesForMonth(year, month)) {
    const key = new Date(year, month, m.date.getDate()).toDateString();
    ensure(key).moon = { phase: m.phase, emoji: m.emoji, label: m.label };
  }

  // Season events
  for (const s of getSeasonEventsForMonth(year, month)) {
    const key = new Date(year, month, s.date.getDate()).toDateString();
    ensure(key).season = { season: s.season, emoji: s.emoji, label: s.label };
  }

  // Zodiac transitions
  for (const z of getZodiacTransitionsForMonth(year, month)) {
    const key = z.date.toDateString();
    ensure(key).zodiac = {
      sign: z.sign.sign,
      emoji: z.sign.emoji,
      label: `${z.sign.sign} begins`,
    };
  }

  return map;
}

/** Returns a short emoji string representing all celestial events on a day. */
export function getCelestialEmojisForDay(events: CelestialDayEvents): string {
  const parts: string[] = [];
  if (events.moon) parts.push(events.moon.emoji);
  if (events.season) parts.push(events.season.emoji);
  if (events.zodiac) parts.push(events.zodiac.emoji);
  return parts.join('');
}
