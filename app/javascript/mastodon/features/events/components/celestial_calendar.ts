/**
 * celestial_calendar.ts
 * Pure-JS celestial date calculations — no external dependencies.
 * Covers: lunar phases, seasons (equinox/solstice), cross-quarter days,
 * perihelion/aphelion.
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
  return (
    Math.floor(365.25 * (Y + 4716)) +
    Math.floor(30.6001 * (M + 1)) +
    d +
    B -
    1524.5
  );
}

/**
 * Returns moon age in days (0 = new moon, ~14.76 = full moon).
 * Reference new moon: 2000-01-06 18:14 UTC (JD 2451550.1)
 */
export function getMoonAge(date: Date): number {
  const jd = toJulianDay(date);
  const knownNewMoonJD = 2451550.1; // Jan 6 2000 new moon
  const daysSince = jd - knownNewMoonJD;
  const age =
    ((daysSince % LUNAR_CYCLE_DAYS) + LUNAR_CYCLE_DAYS) % LUNAR_CYCLE_DAYS;
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
): { date: Date; phase: MoonPhaseName; emoji: string; label: string }[] {
  const results: {
    date: Date;
    phase: MoonPhaseName;
    emoji: string;
    label: string;
  }[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Key phases we want to surface
  const keyPhases: MoonPhaseName[] = [
    'new_moon',
    'first_quarter',
    'full_moon',
    'last_quarter',
  ];
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
  const J0s = [2451623.80984, 2451716.56767, 2451810.21715, 2451900.05952];
  const J1s = [365242.37404, 365241.62603, 365242.01767, 365242.74049];
  const J2s = [0.05169, 0.00325, -0.11575, -0.06223];
  const J3s = [-0.00411, 0.00888, 0.00337, -0.00823];
  const J4s = [-0.00057, -0.0003, 0.00078, 0.00032];
  const J0 = J0s[k] ?? 0;
  const J1 = J1s[k] ?? 0;
  const J2 = J2s[k] ?? 0;
  const J3 = J3s[k] ?? 0;
  const J4 = J4s[k] ?? 0;
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

export interface SeasonEvent {
  date: Date;
  season: SeasonName;
  label: string;
  emoji: string;
}

// Southern Hemisphere: March equinox = Autumn, June solstice = Winter,
// September equinox = Spring, December solstice = Summer.
const SEASON_META: { season: SeasonName; label: string; emoji: string }[] = [
  { season: 'autumn', label: 'Autumn Equinox', emoji: '🍂' },
  { season: 'winter', label: 'Winter Solstice', emoji: '❄️' },
  { season: 'spring', label: 'Spring Equinox', emoji: '🌸' },
  { season: 'summer', label: 'Summer Solstice', emoji: '☀️' },
];

export function getSeasonEventsForYear(year: number): SeasonEvent[] {
  return ([0, 1, 2, 3] as const).map((k) => {
    const jde = seasonJDE(year, k);
    const date = julianDayToDate(jde);
    const meta = SEASON_META[k];
    const season: SeasonName = meta?.season ?? 'spring';
    const label = meta?.label ?? '';
    const emoji = meta?.emoji ?? '';
    return { date, season, label, emoji };
  });
}

export function getSeasonEventsForMonth(
  year: number,
  month: number,
): SeasonEvent[] {
  return getSeasonEventsForYear(year).filter(
    (e) => e.date.getMonth() === month,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cross-quarter days — midpoints between solstices & equinoxes
// Southern Hemisphere naming: Feb=Lammas, May=Samhain, Aug=Imbolc, Nov=Beltane
// ─────────────────────────────────────────────────────────────────────────────

export type CrossQuarterName = 'lammas' | 'samhain' | 'imbolc' | 'beltane';

export interface CrossQuarterEvent {
  date: Date;
  name: CrossQuarterName;
  label: string;
  emoji: string;
}

const CROSS_QUARTER_META: {
  name: CrossQuarterName;
  label: string;
  emoji: string;
}[] = [
  { name: 'lammas', label: 'Lammas', emoji: '🌾' }, // ~Feb: mid-summer harvest
  { name: 'samhain', label: 'Samhain', emoji: '🕯️' }, // ~May: mid-autumn descent
  { name: 'imbolc', label: 'Imbolc', emoji: '🌱' }, // ~Aug: mid-winter stirring
  { name: 'beltane', label: 'Beltane', emoji: '🔥' }, // ~Nov: mid-spring fire
];

export function getCrossQuarterEventsForYear(
  year: number,
): CrossQuarterEvent[] {
  const prevDecJDE = seasonJDE(year - 1, 3);
  const marJDE = seasonJDE(year, 0);
  const junJDE = seasonJDE(year, 1);
  const sepJDE = seasonJDE(year, 2);
  const decJDE = seasonJDE(year, 3);

  const midpoints = [
    (prevDecJDE + marJDE) / 2,
    (marJDE + junJDE) / 2,
    (junJDE + sepJDE) / 2,
    (sepJDE + decJDE) / 2,
  ];

  const fallback = {
    name: 'lammas' as CrossQuarterName,
    label: 'Lammas',
    emoji: '🌾',
  };
  return midpoints.map((jde, i) => {
    const meta = CROSS_QUARTER_META[i] ?? fallback;
    return {
      date: julianDayToDate(jde),
      name: meta.name,
      label: meta.label,
      emoji: meta.emoji,
    };
  });
}

export function getCrossQuarterEventsForMonth(
  year: number,
  month: number,
): CrossQuarterEvent[] {
  return getCrossQuarterEventsForYear(year).filter(
    (e) => e.date.getMonth() === month,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Perihelion & Aphelion — Earth's closest and farthest points from the Sun
// Perihelion ~Jan 3-5, Aphelion ~Jul 4-6 each year.
// Base JDE from known perihelion 2000-01-03 (JD 2451547.507).
// ─────────────────────────────────────────────────────────────────────────────

const PERIHELION_BASE_JDE = 2451547.507;
const ANOMALISTIC_YEAR = 365.259636;

export interface OrbitalEvent {
  date: Date;
  type: 'perihelion' | 'aphelion';
  label: string;
  emoji: string;
}

export function getOrbitalEventsForYear(year: number): OrbitalEvent[] {
  const k = year - 2000;
  return [
    {
      date: julianDayToDate(PERIHELION_BASE_JDE + ANOMALISTIC_YEAR * k),
      type: 'perihelion' as const,
      label: 'Perihelion',
      emoji: '🔆',
    },
    {
      date: julianDayToDate(PERIHELION_BASE_JDE + ANOMALISTIC_YEAR * (k + 0.5)),
      type: 'aphelion' as const,
      label: 'Aphelion',
      emoji: '🔅',
    },
  ];
}

export function getOrbitalEventsForMonth(
  year: number,
  month: number,
): OrbitalEvent[] {
  return getOrbitalEventsForYear(year).filter(
    (e) => e.date.getMonth() === month,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified: get all celestial events for a given month
// ─────────────────────────────────────────────────────────────────────────────

export interface CelestialDayEvents {
  moon?: { phase: MoonPhaseName; emoji: string; label: string };
  season?: { season: SeasonName; emoji: string; label: string };
  crossQuarter?: { name: CrossQuarterName; emoji: string; label: string };
  orbital?: { type: 'perihelion' | 'aphelion'; emoji: string; label: string };
}

/** Returns a Map<dateString, CelestialDayEvents> for the given month. */
export function getCelestialEventsForMonth(
  year: number,
  month: number,
): Map<string, CelestialDayEvents> {
  const map = new Map<string, CelestialDayEvents>();

  const ensure = (dateStr: string): CelestialDayEvents => {
    if (!map.has(dateStr)) map.set(dateStr, {});
    const entry = map.get(dateStr) ?? {};
    map.set(dateStr, entry);
    return entry;
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

  // Cross-quarter days
  for (const cq of getCrossQuarterEventsForMonth(year, month)) {
    const key = new Date(year, month, cq.date.getDate()).toDateString();
    ensure(key).crossQuarter = {
      name: cq.name,
      emoji: cq.emoji,
      label: cq.label,
    };
  }

  // Orbital events (perihelion / aphelion)
  for (const orb of getOrbitalEventsForMonth(year, month)) {
    const key = new Date(year, month, orb.date.getDate()).toDateString();
    ensure(key).orbital = {
      type: orb.type,
      emoji: orb.emoji,
      label: orb.label,
    };
  }

  return map;
}

/** Returns a short emoji string representing all celestial events on a day. */
export function getCelestialEmojisForDay(events: CelestialDayEvents): string {
  const parts: string[] = [];
  if (events.moon) parts.push(events.moon.emoji);
  if (events.season) parts.push(events.season.emoji);
  if (events.crossQuarter) parts.push(events.crossQuarter.emoji);
  if (events.orbital) parts.push(events.orbital.emoji);
  return parts.join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Sunrise / Sunset — USNO algorithm (accurate ±2 min at mid-latitudes)
// Based on the formula from the US Naval Observatory Circular No. 171.
// ─────────────────────────────────────────────────────────────────────────────

const DEG = Math.PI / 180;

/**
 * Returns sunrise and sunset as UTC Date objects for a given local calendar date
 * at the given latitude/longitude (degrees, positive = N/E).
 * Returns null for rise or set if the sun doesn't rise/set (polar).
 */
export function getSunriseSunset(
  year: number,
  month: number, // 0-indexed
  day: number,
  lat: number,
  lon: number,
): { rise: Date | null; set: Date | null } {
  // Day of year
  const N1 = Math.floor((275 * (month + 1)) / 9);
  const N2 = Math.floor((month + 10) / 12);
  const N3 = 1 + Math.floor((year - 4 * Math.floor(year / 4) + 2) / 3);
  const N = N1 - N2 * N3 + day - 30;

  // Longitude hour value and approximate time
  const lngHour = lon / 15;

  function calc(isSunrise: boolean): Date | null {
    const t = N + ((isSunrise ? 6 : 18) - lngHour) / 24;

    // Sun's mean anomaly
    const M = (0.9856 * t - 3.289) * DEG;

    // Sun's true longitude
    let L =
      (M / DEG + 1.916 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 282.634) % 360;
    if (L < 0) L += 360;
    const Lrad = L * DEG;

    // Sun's right ascension
    let RA = (Math.atan(0.91764 * Math.tan(Lrad)) / DEG + 360) % 360;
    const Lquad = Math.floor(L / 90) * 90;
    const RAquad = Math.floor(RA / 90) * 90;
    RA = (RA + Lquad - RAquad) / 15;

    // Sun's declination
    const sinDec = 0.39782 * Math.sin(Lrad);
    const cosDec = Math.cos(Math.asin(sinDec));

    // Sun's local hour angle (zenith = 90.833° for rise/set)
    const cosH =
      (Math.cos(90.833 * DEG) - sinDec * Math.sin(lat * DEG)) /
      (cosDec * Math.cos(lat * DEG));

    if (cosH > 1) return null; // never rises
    if (cosH < -1) return null; // never sets

    const H = isSunrise
      ? (360 - Math.acos(cosH) / DEG) / 15
      : Math.acos(cosH) / DEG / 15;

    const T = H + RA - 0.06571 * t - 6.622;
    const UT = (((T - lngHour) % 24) + 24) % 24;

    const utHour = Math.floor(UT);
    const utMin = Math.round((UT - utHour) * 60);

    // Clamp overflow minutes
    const totalMin = utHour * 60 + utMin;
    const clampedHour = Math.floor(totalMin / 60) % 24;
    const clampedMin = totalMin % 60;

    return new Date(Date.UTC(year, month, day, clampedHour, clampedMin));
  }

  return { rise: calc(true), set: calc(false) };
}

export interface DaylightInfo {
  rise: Date | null;
  set: Date | null;
  daylightMinutes: number;
  deltaMinutes: number; // positive = days are lengthening
  nextTurningPoint: { date: Date; label: string; emoji: string };
}

/**
 * Returns daylight info for a given local date at lat/lon.
 * deltaMinutes is the change from yesterday.
 */
export function getDaylightInfo(
  year: number,
  month: number,
  day: number,
  lat: number,
  lon: number,
): DaylightInfo {
  const today = getSunriseSunset(year, month, day, lat, lon);
  const yDate = new Date(year, month, day);
  yDate.setDate(yDate.getDate() - 1);
  const yesterday = getSunriseSunset(
    yDate.getFullYear(),
    yDate.getMonth(),
    yDate.getDate(),
    lat,
    lon,
  );

  const todayMins =
    today.rise && today.set
      ? (today.set.getTime() - today.rise.getTime()) / 60000
      : 0;
  const yesterdayMins =
    yesterday.rise && yesterday.set
      ? (yesterday.set.getTime() - yesterday.rise.getTime()) / 60000
      : 0;

  const deltaMinutes = Math.round((todayMins - yesterdayMins) * 10) / 10;

  // Next turning point: find the nearest season event after today
  const todayDate = new Date(year, month, day);
  const candidates = [
    ...getSeasonEventsForYear(year),
    ...getSeasonEventsForYear(year + 1),
  ].filter((e) => e.date >= todayDate);
  candidates.sort((a, b) => a.date.getTime() - b.date.getTime());
  const next = candidates[0] ?? getSeasonEventsForYear(year + 1)[0];

  return {
    rise: today.rise,
    set: today.set,
    daylightMinutes: Math.round(todayMins),
    deltaMinutes,
    nextTurningPoint: {
      date: next?.date ?? new Date(),
      label: next?.label ?? '',
      emoji: next?.emoji ?? '',
    },
  };
}
