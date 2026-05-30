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
  meteorShower?: { name: string; zenithalHourlyRate: number };
  eclipse?: { type: EclipseType; label: string; emoji: string };
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

  // Meteor showers
  const daysInMonth2 = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth2; d++) {
    const peak = getMeteorShowerPeak(month, d);
    if (peak) {
      const key = new Date(year, month, d).toDateString();
      ensure(key).meteorShower = {
        name: peak.name,
        zenithalHourlyRate: peak.zenithalHourlyRate,
      };
    }
  }

  // Eclipses
  for (let d = 1; d <= daysInMonth2; d++) {
    const dayDate = new Date(year, month, d, 12, 0, 0);
    const eclipses = getEclipsesNear(dayDate, 0);
    if (eclipses.length > 0 && eclipses[0]) {
      const key = new Date(year, month, d).toDateString();
      ensure(key).eclipse = {
        type: eclipses[0].type,
        label: eclipses[0].label,
        emoji: eclipses[0].emoji,
      };
    }
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
  if (events.meteorShower) parts.push('✨');
  if (events.eclipse) parts.push(events.eclipse.emoji);
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

  // Rise/set are UTC Date objects from the USNO algorithm, which always stamps
  // them with the *requested* calendar date. For timezones ahead of UTC (e.g.
  // Melbourne UTC+10), sunrise UTC wraps into the next UTC day, making the raw
  // difference negative. Adding 24h when the diff is negative corrects this.
  function daylightMins(r: Date | null, s: Date | null): number {
    if (!r || !s) return 0;
    const raw = (s.getTime() - r.getTime()) / 60000;
    return raw < 0 ? raw + 24 * 60 : raw;
  }
  const todayMins = daylightMins(today.rise, today.set);
  const yesterdayMins = daylightMins(yesterday.rise, yesterday.set);

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

// ─────────────────────────────────────────────────────────────────────────────
// Moon rise / set — USNO simplified algorithm
// Accurate to ±10 min for mid-latitudes.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns moon rise and set as UTC Dates for a given local calendar date
 * at lat/lon. Returns null where the moon doesn't rise or set that day.
 */
export function getMoonRiseSet(
  year: number,
  month: number,
  day: number,
  lat: number,
  lon: number,
): { rise: Date | null; set: Date | null } {
  // Use the same horizon-hour-angle approach as the sun, but with the moon's
  // mean longitude approximation. We scan the day in 10-min steps to find
  // the hour angle crossing.

  function moonRaDec(jd: number): { ra: number; dec: number } {
    const T = (jd - 2451545.0) / 36525;
    // Moon's mean longitude, mean anomaly, mean elongation, node (all degrees)
    const L0 = (218.3164477 + 481267.88123421 * T) % 360;
    const M = ((357.5291092 + 35999.0502909 * T) % 360) * DEG; // sun's anomaly
    const Mprime = ((134.9633964 + 477198.8675055 * T) % 360) * DEG; // moon's anomaly
    const D = ((297.8501921 + 445267.1114034 * T) % 360) * DEG; // elongation
    const Om = ((125.0445479 - 1934.1362608 * T) % 360) * DEG; // node

    // Longitude correction (degrees) — main terms only
    const dLon =
      6.289 * Math.sin(Mprime) -
      1.274 * Math.sin(2 * D - Mprime) +
      0.658 * Math.sin(2 * D) -
      0.186 * Math.sin(M) -
      0.059 * Math.sin(2 * Mprime - 2 * D) -
      0.057 * Math.sin(Mprime - 2 * D + M) +
      0.053 * Math.sin(Mprime + 2 * D) +
      0.046 * Math.sin(2 * D - M) +
      0.041 * Math.sin(Mprime - M) -
      0.035 * Math.sin(D) -
      0.031 * Math.sin(Mprime + M) -
      0.015 * Math.sin(2 * Om) +
      0.011 * Math.sin(Mprime - 4 * D);

    const dLat =
      5.128 * Math.sin(Om) +
      0.281 * Math.sin(Mprime + Om) -
      0.278 * Math.sin(Mprime - Om) -
      0.173 * Math.sin(3 * Om) +
      0.055 * Math.sin(2 * Mprime - Om);

    // Ecliptic coordinates → equatorial
    const lon = (L0 + dLon) * DEG;
    const latMoon = dLat * DEG;
    const eps = 23.4393 * DEG; // obliquity (approximate)

    const sinDec =
      Math.sin(latMoon) * Math.cos(eps) +
      Math.cos(latMoon) * Math.sin(eps) * Math.sin(lon);
    const dec = Math.asin(sinDec);

    const y = Math.sin(lon) * Math.cos(eps) - Math.tan(latMoon) * Math.sin(eps);
    const x = Math.cos(lon);
    const ra = Math.atan2(y, x);

    return { ra, dec }; // radians
  }

  // Scan 24h in 10-min steps; find sign change in altitude relative to horizon
  const jdBase = toJulianDay(new Date(Date.UTC(year, month, day, 12, 0, 0)));
  const latRad = lat * DEG;
  const horz = -0.833 * DEG; // horizon dip in radians (same as sun)

  let prevAlt: number | null = null;
  let rise: Date | null = null;
  let set: Date | null = null;

  for (let step = 0; step <= 144; step++) {
    const fracDay = step / 144;
    const jd = jdBase - 0.5 + fracDay; // noon ±12h
    const { ra, dec } = moonRaDec(jd);

    // Local sidereal time (approx)
    const gmst = (18.697374558 + 24.06570982441908 * (jd - 2451545.0)) % 24;
    const lst = ((gmst + lon / 15) % 24) * 15 * DEG;
    const ha = lst - ra;

    const sinAlt =
      Math.sin(dec) * Math.sin(latRad) +
      Math.cos(dec) * Math.cos(latRad) * Math.cos(ha);
    const alt = Math.asin(sinAlt);

    if (prevAlt !== null) {
      if (prevAlt < horz && alt >= horz && rise === null) {
        const utcFrac = (step - 0.5) / 144;
        const utcHour = utcFrac * 24;
        rise = new Date(
          Date.UTC(
            year,
            month,
            day,
            Math.floor(utcHour),
            Math.round((utcHour % 1) * 60),
          ),
        );
      }
      if (prevAlt >= horz && alt < horz && set === null) {
        const utcFrac = (step - 0.5) / 144;
        const utcHour = utcFrac * 24;
        set = new Date(
          Date.UTC(
            year,
            month,
            day,
            Math.floor(utcHour),
            Math.round((utcHour % 1) * 60),
          ),
        );
      }
    }
    prevAlt = alt;
  }

  return { rise, set };
}

// ─────────────────────────────────────────────────────────────────────────────
// The Dial — IAU constellation the sun is actually in (not the sign)
// Based on the IAU 1930 constellation boundaries mapped to ecliptic longitude.
// ─────────────────────────────────────────────────────────────────────────────

interface ConstellationBand {
  name: string;
  emoji: string;
  description: string;
  maxLon: number; // ecliptic longitude upper bound (degrees, 0–360)
}

// Sorted ascending by maxLon. Ecliptic longitude of sun for date d:
// roughly L = 280.46 + 0.9856474 * (JD - 2451545.0)
// The sun moves ~1° per day eastward through the ecliptic.
const CONSTELLATION_BANDS: ConstellationBand[] = [
  {
    name: 'Sagittarius',
    emoji: '🏹',
    description:
      'Toward the galactic centre — the densest, most luminous field of stars in the sky',
    maxLon: 270,
  },
  {
    name: 'Capricornus',
    emoji: '🐐',
    description:
      'The sea-goat — a faint ancient figure at the edge of the celestial sea',
    maxLon: 300,
  },
  {
    name: 'Aquarius',
    emoji: '🏺',
    description:
      'The water-carrier — a sprawling figure pouring its stream southward into Piscis Austrinus',
    maxLon: 330,
  },
  {
    name: 'Pisces',
    emoji: '🐟',
    description:
      'Two fish trailing long cords — the vernal equinox point resides here, slowly drifting from Aries',
    maxLon: 352,
  },
  {
    name: 'Aries',
    emoji: '🐏',
    description:
      'A small, quiet constellation; the sun passed through the vernal equinox point here 2000 years ago',
    maxLon: 28,
  },
  {
    name: 'Taurus',
    emoji: '🐂',
    description:
      'The Pleiades and Hyades clusters lie here — some of the most prominent open clusters in the night sky',
    maxLon: 63,
  },
  {
    name: 'Gemini',
    emoji: '👯',
    description:
      'The June solstice occurs here — the sun reaches its highest arc of the year within these boundaries',
    maxLon: 90,
  },
  {
    name: 'Cancer',
    emoji: '🦀',
    description:
      'The faintest of the zodiacal constellations, but home to the Beehive Cluster (M44)',
    maxLon: 118,
  },
  {
    name: 'Leo',
    emoji: '🦁',
    description:
      'A prominent figure with Regulus as its bright heart — one of the few constellations resembling its namesake',
    maxLon: 138,
  },
  {
    name: 'Virgo',
    emoji: '🌾',
    description:
      'The largest zodiacal constellation; the autumn equinox point lies here, and the Virgo Cluster of galaxies fills its depths',
    maxLon: 174,
  },
  {
    name: 'Libra',
    emoji: '⚖️',
    description:
      'The scales — once the claws of Scorpius in ancient maps, separated into its own figure',
    maxLon: 218,
  },
  {
    name: 'Ophiuchus',
    emoji: '🐍',
    description:
      'The sun spends more time here than in Scorpius — a 13th figure the ecliptic genuinely passes through',
    maxLon: 241,
  },
  {
    name: 'Scorpius',
    emoji: '🦂',
    description:
      'One of the most recognisable constellations; the sun passes through briefly before entering Ophiuchus',
    maxLon: 270,
  },
];

export interface SunConstellationInfo {
  name: string;
  emoji: string;
  description: string;
}

export function getSunConstellation(date: Date): SunConstellationInfo {
  const jd = toJulianDay(date);
  let lon = (280.46 + 0.9856474 * (jd - 2451545.0)) % 360;
  if (lon < 0) lon += 360;

  for (const band of CONSTELLATION_BANDS) {
    if (lon < band.maxLon) {
      return {
        name: band.name,
        emoji: band.emoji,
        description: band.description,
      };
    }
  }
  // Wrap-around: Sagittarius at the end
  const last = CONSTELLATION_BANDS[CONSTELLATION_BANDS.length - 1];
  return {
    name: last?.name ?? 'Sagittarius',
    emoji: last?.emoji ?? '🏹',
    description: last?.description ?? '',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Wanderers — visible planets tonight (magnitude < threshold, above horizon)
// Uses simplified VSOP87 mean elements — accurate to ~1° for bright planets.
// ─────────────────────────────────────────────────────────────────────────────

export interface WandererInfo {
  name: string;
  emoji: string;
  magnitude: number;
  isVisible: boolean; // above horizon at astronomical twilight
  riseSet?: { rise: Date | null; set: Date | null };
}

interface PlanetElements {
  name: string;
  emoji: string;
  // Mean elements at J2000 (for a simplified position)
  L0: number; // mean longitude (deg)
  L1: number; // mean motion (deg/day)
  a: number; // semi-major axis (AU)
  e: number; // eccentricity
  i: number; // inclination (deg)
  baseMag: number; // base magnitude at 1AU
}

const PLANET_ELEMENTS: PlanetElements[] = [
  {
    name: 'Mercury',
    emoji: '☿',
    L0: 252.251,
    L1: 4.09234,
    a: 0.387,
    e: 0.206,
    i: 7.0,
    baseMag: -0.42,
  },
  {
    name: 'Venus',
    emoji: '♀',
    L0: 181.98,
    L1: 1.60214,
    a: 0.723,
    e: 0.007,
    i: 3.39,
    baseMag: -4.4,
  },
  {
    name: 'Mars',
    emoji: '♂',
    L0: 355.433,
    L1: 0.52403,
    a: 1.524,
    e: 0.093,
    i: 1.85,
    baseMag: -1.52,
  },
  {
    name: 'Jupiter',
    emoji: '♃',
    L0: 34.396,
    L1: 0.08309,
    a: 5.203,
    e: 0.049,
    i: 1.3,
    baseMag: -9.4,
  },
  {
    name: 'Saturn',
    emoji: '♄',
    L0: 50.077,
    L1: 0.03346,
    a: 9.537,
    e: 0.057,
    i: 2.49,
    baseMag: -8.88,
  },
];

function planetEclipticLon(p: PlanetElements, jd: number): number {
  const d = jd - 2451545.0;
  const M = ((p.L0 + p.L1 * d) % 360) * DEG;
  // Equation of centre (simplified)
  const eqC =
    (2 * p.e - p.e ** 3 / 4) * Math.sin(M) +
    (5 / 4) * p.e ** 2 * Math.sin(2 * M);
  return (((p.L0 + p.L1 * d + eqC / DEG) % 360) + 360) % 360;
}

function planetDistanceAU(p: PlanetElements, jd: number): number {
  const d = jd - 2451545.0;
  const M = ((p.L0 + p.L1 * d) % 360) * DEG;
  return p.a * (1 - p.e * Math.cos(M));
}

export function getWanderers(
  year: number,
  month: number,
  day: number,
  lat: number,
  lon: number,
): WandererInfo[] {
  const jd = toJulianDay(new Date(Date.UTC(year, month, day, 21, 0, 0))); // 9pm UTC
  const latRad = lat * DEG;

  // Sun position for elongation
  const sunLon = (280.46 + 0.9856474 * (jd - 2451545.0) + 360) % 360;

  return PLANET_ELEMENTS.map((p) => {
    const pLon = planetEclipticLon(p, jd);
    const r = planetDistanceAU(p, jd);

    // Earth-sun distance for this date
    const earthR =
      1.0 - 0.01672 * Math.cos((357.5291 + 0.9856003 * (jd - 2451545)) * DEG);

    // Approximate distance from Earth (inferior/superior simplified)
    const elongation = Math.abs(pLon - sunLon);
    const elong = elongation > 180 ? 360 - elongation : elongation;

    // Very simple magnitude estimate
    const dist =
      p.a <= 1
        ? Math.sqrt(
            earthR ** 2 + r ** 2 - 2 * earthR * r * Math.cos(elong * DEG),
          )
        : r - earthR;
    const mag = p.baseMag + 2.5 * Math.log10(Math.max(0.1, r * Math.abs(dist)));

    // Altitude at midnight local: use hour angle from RA
    const eps = 23.4393 * DEG;
    const pLonRad = pLon * DEG;
    const dec = Math.asin(
      Math.sin(eps) * Math.sin(pLonRad) * Math.cos(p.i * DEG) +
        Math.cos(eps) * Math.sin(p.i * DEG),
    );

    // Hour angle at midnight
    const gmst = (18.697374558 + 24.06570982441908 * (jd - 2451545.0)) % 24;
    const lst = ((gmst + lon / 15) % 24) * 15 * DEG;
    const ra = Math.atan2(
      Math.cos(eps) * Math.sin(pLonRad) - Math.tan(p.i * DEG) * Math.sin(eps),
      Math.cos(pLonRad),
    );
    const ha = lst - ra;

    const sinAlt =
      Math.sin(dec) * Math.sin(latRad) +
      Math.cos(dec) * Math.cos(latRad) * Math.cos(ha);

    const isVisible = sinAlt > Math.sin(-18 * DEG) && elong > 15; // above astronomical twilight, not too close to sun

    return {
      name: p.name,
      emoji: p.emoji,
      magnitude: Math.round(mag * 10) / 10,
      isVisible,
    };
  }).filter((w) => w.isVisible);
}

// ─────────────────────────────────────────────────────────────────────────────
// Moon distance and supermoon detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Approximate moon distance in km using the moon's anomaly.
 * Accurate to ~1% — enough for supermoon classification.
 */
export function getMoonDistanceKm(date: Date): number {
  const jd = toJulianDay(date);
  const T = (jd - 2451545.0) / 36525;
  // Moon's mean anomaly (degrees)
  const Mprime = (((134.9633964 + 477198.8675055 * T) % 360) + 360) % 360;
  const MprimeRad = Mprime * (Math.PI / 180);
  // Simplified distance formula (km) — Jean Meeus, Astronomical Algorithms
  const meanDist = 385000.56;
  const correction =
    -20905.355 * Math.cos(MprimeRad) +
    -3699.111 *
      Math.cos(
        2 * MprimeRad -
          2 * (Math.PI / 180) * ((297.8501921 + 445267.1114034 * T) % 360),
      ) +
    -2955.968 *
      Math.cos(
        2 * (Math.PI / 180) * ((297.8501921 + 445267.1114034 * T) % 360),
      ) +
    -569.925 * Math.cos(2 * MprimeRad);
  return meanDist + correction;
}

export interface SuperMoonInfo {
  isSuper: boolean;
  distanceKm: number;
}

/**
 * Returns whether today's moon is a supermoon (full or new moon within
 * ~90% of closest perigee distance — threshold ~362,000 km).
 */
export function getSuperMoonInfo(date: Date): SuperMoonInfo {
  const phase = getMoonPhaseName(date);
  const distanceKm = getMoonDistanceKm(date);
  const isNearFull = phase === 'full_moon' || phase === 'new_moon';
  const isSuper = isNearFull && distanceKm < 362000;
  return { isSuper, distanceKm: Math.round(distanceKm) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Meteor showers (annual, fixed calendar peaks)
// ─────────────────────────────────────────────────────────────────────────────

export interface MeteorShower {
  name: string;
  peakMonth: number; // 0-indexed
  peakDay: number;
  windowDays: number; // days either side of peak to show as active
  zenithalHourlyRate: number;
  radiant: string; // constellation
}

const METEOR_SHOWERS: MeteorShower[] = [
  {
    name: 'Quadrantids',
    peakMonth: 0,
    peakDay: 3,
    windowDays: 2,
    zenithalHourlyRate: 120,
    radiant: 'Boötes',
  },
  {
    name: 'Lyrids',
    peakMonth: 3,
    peakDay: 22,
    windowDays: 3,
    zenithalHourlyRate: 18,
    radiant: 'Lyra',
  },
  {
    name: 'Eta Aquariids',
    peakMonth: 4,
    peakDay: 6,
    windowDays: 4,
    zenithalHourlyRate: 50,
    radiant: 'Aquarius',
  },
  {
    name: 'Delta Aquariids',
    peakMonth: 6,
    peakDay: 30,
    windowDays: 5,
    zenithalHourlyRate: 20,
    radiant: 'Aquarius',
  },
  {
    name: 'Perseids',
    peakMonth: 7,
    peakDay: 12,
    windowDays: 4,
    zenithalHourlyRate: 100,
    radiant: 'Perseus',
  },
  {
    name: 'Orionids',
    peakMonth: 9,
    peakDay: 21,
    windowDays: 3,
    zenithalHourlyRate: 20,
    radiant: 'Orion',
  },
  {
    name: 'Leonids',
    peakMonth: 10,
    peakDay: 17,
    windowDays: 2,
    zenithalHourlyRate: 15,
    radiant: 'Leo',
  },
  {
    name: 'Geminids',
    peakMonth: 11,
    peakDay: 14,
    windowDays: 3,
    zenithalHourlyRate: 150,
    radiant: 'Gemini',
  },
  {
    name: 'Ursids',
    peakMonth: 11,
    peakDay: 22,
    windowDays: 2,
    zenithalHourlyRate: 10,
    radiant: 'Ursa Minor',
  },
];

/** Returns meteor showers active (within their window) on the given date. */
export function getActiveMeteorShowers(
  month: number,
  day: number,
): MeteorShower[] {
  return METEOR_SHOWERS.filter((s) => {
    const diff = Math.abs(month * 30 + day - (s.peakMonth * 30 + s.peakDay));
    // Also handle year wrap (Ursids/Quadrantids boundary)
    const diffWrapped = Math.min(diff, 365 - diff);
    return diffWrapped <= s.windowDays;
  });
}

/** Returns true if the given date is the peak day (±1 day) of any shower. */
export function getMeteorShowerPeak(
  month: number,
  day: number,
): MeteorShower | undefined {
  return METEOR_SHOWERS.find((s) => {
    const diff = Math.abs(month * 30 + day - (s.peakMonth * 30 + s.peakDay));
    const diffWrapped = Math.min(diff, 365 - diff);
    return diffWrapped <= 1;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Eclipses — lookup table 2024–2032
// Sources: NASA Eclipse Catalog, timeanddate.com
// ─────────────────────────────────────────────────────────────────────────────

export type EclipseType =
  | 'total_solar'
  | 'annular_solar'
  | 'partial_solar'
  | 'total_lunar'
  | 'partial_lunar'
  | 'penumbral_lunar';

export interface EclipseEvent {
  date: Date;
  type: EclipseType;
  label: string;
  emoji: string;
  visibility: string; // brief region note
}

const ECLIPSE_TABLE: EclipseEvent[] = [
  // 2024
  {
    date: new Date('2024-03-25'),
    type: 'penumbral_lunar',
    label: 'Penumbral Lunar Eclipse',
    emoji: '🌕',
    visibility: 'Americas, Europe, Africa',
  },
  {
    date: new Date('2024-04-08'),
    type: 'total_solar',
    label: 'Total Solar Eclipse',
    emoji: '🌑',
    visibility: 'North America',
  },
  {
    date: new Date('2024-09-18'),
    type: 'partial_lunar',
    label: 'Partial Lunar Eclipse',
    emoji: '🌕',
    visibility: 'Americas, Europe, Africa',
  },
  {
    date: new Date('2024-10-02'),
    type: 'annular_solar',
    label: 'Annular Solar Eclipse',
    emoji: '🌑',
    visibility: 'South America',
  },
  // 2025
  {
    date: new Date('2025-03-14'),
    type: 'total_lunar',
    label: 'Total Lunar Eclipse',
    emoji: '🌕',
    visibility: 'Americas, Pacific, Australia',
  },
  {
    date: new Date('2025-03-29'),
    type: 'partial_solar',
    label: 'Partial Solar Eclipse',
    emoji: '🌑',
    visibility: 'North Atlantic, Europe',
  },
  {
    date: new Date('2025-09-07'),
    type: 'total_lunar',
    label: 'Total Lunar Eclipse',
    emoji: '🌕',
    visibility: 'Europe, Africa, Asia, Australia',
  },
  {
    date: new Date('2025-09-21'),
    type: 'partial_solar',
    label: 'Partial Solar Eclipse',
    emoji: '🌑',
    visibility: 'Southern Ocean, New Zealand',
  },
  // 2026
  {
    date: new Date('2026-02-17'),
    type: 'annular_solar',
    label: 'Annular Solar Eclipse',
    emoji: '🌑',
    visibility: 'Antarctica, southern tip of South America',
  },
  {
    date: new Date('2026-03-03'),
    type: 'total_lunar',
    label: 'Total Lunar Eclipse',
    emoji: '🌕',
    visibility: 'Americas, Europe, Africa, Asia',
  },
  {
    date: new Date('2026-08-12'),
    type: 'total_solar',
    label: 'Total Solar Eclipse',
    emoji: '🌑',
    visibility: 'Greenland, Iceland, Spain',
  },
  {
    date: new Date('2026-08-28'),
    type: 'partial_lunar',
    label: 'Partial Lunar Eclipse',
    emoji: '🌕',
    visibility: 'Pacific, Americas, Europe',
  },
  // 2027
  {
    date: new Date('2027-02-06'),
    type: 'annular_solar',
    label: 'Annular Solar Eclipse',
    emoji: '🌑',
    visibility: 'South America, Atlantic, Africa',
  },
  {
    date: new Date('2027-07-18'),
    type: 'penumbral_lunar',
    label: 'Penumbral Lunar Eclipse',
    emoji: '🌕',
    visibility: 'Africa, Europe, Asia, Australia',
  },
  {
    date: new Date('2027-08-02'),
    type: 'total_solar',
    label: 'Total Solar Eclipse',
    emoji: '🌑',
    visibility: 'Morocco, Spain, Libya, Egypt, Saudi Arabia',
  },
  // 2028
  {
    date: new Date('2028-01-12'),
    type: 'partial_lunar',
    label: 'Partial Lunar Eclipse',
    emoji: '🌕',
    visibility: 'Americas, Europe, Africa, Asia',
  },
  {
    date: new Date('2028-01-26'),
    type: 'annular_solar',
    label: 'Annular Solar Eclipse',
    emoji: '🌑',
    visibility: 'Ecuador, Peru, Brazil',
  },
  {
    date: new Date('2028-07-06'),
    type: 'partial_lunar',
    label: 'Partial Lunar Eclipse',
    emoji: '🌕',
    visibility: 'Pacific, Americas, Europe, Africa',
  },
  {
    date: new Date('2028-07-22'),
    type: 'total_solar',
    label: 'Total Solar Eclipse',
    emoji: '🌑',
    visibility: 'Australia, New Zealand',
  },
  // 2029
  {
    date: new Date('2029-01-01'),
    type: 'total_lunar',
    label: 'Total Lunar Eclipse',
    emoji: '🌕',
    visibility: 'Europe, Africa, Asia, Australia',
  },
  {
    date: new Date('2029-06-12'),
    type: 'total_lunar',
    label: 'Total Lunar Eclipse',
    emoji: '🌕',
    visibility: 'Americas, Europe, Africa',
  },
  {
    date: new Date('2029-11-25'),
    type: 'total_lunar',
    label: 'Total Lunar Eclipse',
    emoji: '🌕',
    visibility: 'Americas, Europe, Africa, Asia',
  },
  // 2030
  {
    date: new Date('2030-04-21'),
    type: 'annular_solar',
    label: 'Annular Solar Eclipse',
    emoji: '🌑',
    visibility: 'Australia (ring visible from south-west WA)',
  },
  {
    date: new Date('2030-10-15'),
    type: 'annular_solar',
    label: 'Annular Solar Eclipse',
    emoji: '🌑',
    visibility: 'Europe, North Africa, central Asia',
  },
  // 2031
  {
    date: new Date('2031-05-07'),
    type: 'total_lunar',
    label: 'Total Lunar Eclipse',
    emoji: '🌕',
    visibility: 'Americas, Europe, Africa, Asia',
  },
  {
    date: new Date('2031-11-01'),
    type: 'total_lunar',
    label: 'Total Lunar Eclipse',
    emoji: '🌕',
    visibility: 'Asia, Australia, Pacific',
  },
  // 2032
  {
    date: new Date('2032-04-25'),
    type: 'total_lunar',
    label: 'Total Lunar Eclipse',
    emoji: '🌕',
    visibility: 'Asia, Australia, Pacific',
  },
];

/** Returns eclipses occurring within ±3 days of the given date. */
export function getEclipsesNear(date: Date, windowDays = 3): EclipseEvent[] {
  const t = date.getTime();
  const window = windowDays * 86400000;
  return ECLIPSE_TABLE.filter((e) => Math.abs(e.date.getTime() - t) <= window);
}

/** Returns the next eclipse on or after the given date. */
export function getNextEclipse(date: Date): EclipseEvent | undefined {
  const t = date.getTime();
  return ECLIPSE_TABLE.find((e) => e.date.getTime() >= t);
}
