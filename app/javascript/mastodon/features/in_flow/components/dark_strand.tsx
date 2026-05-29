import { useMemo } from 'react';

import {
  getMoonPhaseName,
  getMoonIllumination,
  getMoonRiseSet,
  getSunConstellation,
  getWanderers,
  getSuperMoonInfo,
  getMeteorShowerPeak,
} from 'mastodon/features/events/components/celestial_calendar';

import { LOCATION_TZ, LOCATION_LAT, LOCATION_LON } from '../constants';

import { MoonPhaseIcon, StarIcon } from './celestial_icons';
import { ConstellationSVG } from './constellation_map';

const MOON_LABELS: Record<string, string> = {
  new_moon: 'New Moon',
  waxing_crescent: 'Waxing Crescent',
  first_quarter: 'First Quarter',
  waxing_gibbous: 'Waxing Gibbous',
  full_moon: 'Full Moon',
  waning_gibbous: 'Waning Gibbous',
  last_quarter: 'Last Quarter',
  waning_crescent: 'Waning Crescent',
};

function getMoonContextDescription(
  phase: string,
  constellationName: string,
  superMoon: { isSuper: boolean; distanceKm: number },
  meteorPeak: { name: string; zenithalHourlyRate: number } | undefined,
): string {
  const base: Record<string, string> = {
    new_moon:
      'The moon is absent from the sky — the darkest nights of the cycle.',
    waxing_crescent:
      'A thin crescent follows the sun toward the western horizon after dusk.',
    first_quarter:
      'Half the face is lit, setting near midnight. Look along the terminator for deep crater shadows.',
    waxing_gibbous:
      'Growing toward full — the terminator retreats and the lunar surface opens up.',
    full_moon: 'The moon rises at sunset and holds the sky all night.',
    waning_gibbous:
      'Past full now, the moon rises later into the evening and stays into morning.',
    last_quarter:
      'Rising near midnight, the half-lit moon leaves early evenings beautifully dark.',
    waning_crescent:
      'A sliver hangs in the pre-dawn east — evenings are quiet and dark.',
  };

  const parts: string[] = [base[phase] ?? ''];

  if (superMoon.isSuper && (phase === 'full_moon' || phase === 'new_moon')) {
    parts.push(
      `At ${String(Math.round(superMoon.distanceKm / 1000))}k km away, the moon is at perigee — a supermoon, closer and brighter than usual.`,
    );
  }

  if (meteorPeak) {
    parts.push(
      `The ${meteorPeak.name} shower peaks tonight, radiating from ${constellationName} — up to ${String(meteorPeak.zenithalHourlyRate)} meteors per hour if the sky is clear.`,
    );
  }

  return parts.join(' ');
}

// Observable constellation directions for Melbourne sky
const CONSTELLATION_OBSERVABLE: Record<string, string> = {
  Sagittarius:
    "Face north after dark — Sagittarius sits low on the northern horizon from Melbourne. Its teapot asterism (six or seven stars in a kettle shape) is best seen on clear evenings from late autumn into winter. The Milky Way appears to rise from the teapot's spout.",
  Capricornus:
    'Look northeast after sunset. Capricornus is a faint constellation — no bright stars — but its distinctive triangular arc of dim points can be traced from about 60° above the northeastern horizon.',
  Aquarius:
    'Aquarius is large but faint. Find it in the northern sky: look for Sadalsuud, its brightest star (still only magnitude 2.9), roughly northeast at dusk. No prominent shape; best appreciated under dark skies away from city light.',
  Pisces:
    'Pisces is very faint. In the northern sky (near the equator as seen from Melbourne), its two loops of dim stars require dark skies. Look for the two circlets with a curving cord between them, near the celestial equator.',
  Aries:
    'Aries contains just three moderately bright stars in a shallow arc. Find Hamal (the brightest, magnitude 2.0) in the north-northeast sky. The arc opens toward Taurus to the east.',
  Taurus:
    'Taurus is prominent. Look north-northeast for the distinct V of the Hyades cluster with orange Aldebaran at its tip — the brightest star in that region of sky. The Pleiades (Seven Sisters) sparkle as a compact blue-white smudge to the upper-right of Aldebaran.',
  Gemini:
    'Find Gemini in the northern sky: Castor and Pollux are the two bright stars side by side near the top. From Melbourne they sit fairly low in the north but are still easy naked-eye objects. Pollux is slightly brighter and has a distinctly warm tint.',
  Cancer:
    'Cancer is faint — best located between the bright stars Pollux (in Gemini) to the west and Regulus (in Leo) to the east. Under dark skies, look for the Beehive Cluster (M44), a fuzzy patch visible to the naked eye.',
  Leo: 'Leo is striking. Look north for the Sickle — a backward question-mark shape with bright Regulus at its base. Regulus sits on the ecliptic; the moon and planets regularly pass close to it. From Melbourne, Leo transits the northern sky at a reasonable altitude.',
  Virgo:
    'Virgo is the largest zodiacal constellation. Find brilliant blue-white Spica in the north-northwest (a spike of light, hard to miss). The rest of the constellation spreads westward and northward from Spica in a Y-shape.',
  Libra:
    'Libra sits between Virgo (to the west) and Scorpius (to the east). Its two brightest stars form a rough trapezoid. Zubenelgenubi is just wide enough to split into two stars with the naked eye under steady conditions.',
  Ophiuchus:
    "Ophiuchus is large and sits above Scorpius in the northern sky. Its brightest star Rasalhague marks the serpent bearer's head. The constellation straddles the Milky Way — look for a broad, slightly irregular polygon of stars between Scorpius below and Hercules above.",
  Scorpius:
    'Scorpius is one of the most beautiful constellations and from Melbourne it sits high — almost overhead in mid-winter evenings. Look for orange-red Antares at the heart, with the fishhook curve of stars sweeping to the south. The tail ends in two close stars (the stinger): Shaula and Lesath.',
};

function nowInLocation(): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat('en-AU', {
    timeZone: LOCATION_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(new Date());
  const get = (type: string): number =>
    parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
  return { year: get('year'), month: get('month') - 1, day: get('day') };
}

function formatTimeInLocation(date: Date): string {
  return date.toLocaleTimeString('en-AU', {
    timeZone: LOCATION_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export const DarkStrand: React.FC = () => {
  const { year, month, day } = useMemo(nowInLocation, []);
  const now = useMemo(() => new Date(), []);

  const phase = useMemo(() => getMoonPhaseName(now), [now]);
  const illumination = useMemo(
    () => Math.round(getMoonIllumination(now) * 100),
    [now],
  );
  const moonRiseSet = useMemo(
    () => getMoonRiseSet(year, month, day, LOCATION_LAT, LOCATION_LON),
    [year, month, day],
  );
  const constellation = useMemo(() => getSunConstellation(now), [now]);
  const wanderers = useMemo(
    () => getWanderers(year, month, day, LOCATION_LAT, LOCATION_LON),
    [year, month, day],
  );
  const superMoon = useMemo(() => getSuperMoonInfo(now), [now]);
  const meteorPeak = useMemo(
    () => getMeteorShowerPeak(month, day),
    [month, day],
  );

  const phaseLabel = MOON_LABELS[phase] ?? phase;
  const phaseDesc = getMoonContextDescription(
    phase,
    constellation.name,
    superMoon,
    meteorPeak ?? undefined,
  );
  const dialObservable =
    CONSTELLATION_OBSERVABLE[constellation.name] ?? constellation.description;

  return (
    <div className='in-flow-dark'>
      {/* Moon */}
      <div className='in-flow-dark__moon'>
        <div className='in-flow-dark__moon-header'>
          <div className='in-flow-dark__moon-icon'>
            <MoonPhaseIcon phase={phase} size={40} />
          </div>
          <div className='in-flow-dark__moon-meta'>
            <span className='in-flow-dark__moon-phase'>{phaseLabel}</span>
            <span className='in-flow-dark__moon-illumination'>
              {illumination}% illuminated
            </span>
          </div>
        </div>
        <p className='in-flow-dark__moon-desc'>{phaseDesc}</p>

        {(moonRiseSet.rise ?? moonRiseSet.set) && (
          <div className='in-flow-dark__moon-times'>
            {moonRiseSet.rise && (
              <div className='in-flow-dark__time-pair'>
                <span className='in-flow-dark__time-icon'>rises</span>
                <span className='in-flow-dark__time-value'>
                  {formatTimeInLocation(moonRiseSet.rise)}
                </span>
              </div>
            )}
            {moonRiseSet.set && (
              <div className='in-flow-dark__time-pair'>
                <span className='in-flow-dark__time-icon'>sets</span>
                <span className='in-flow-dark__time-value'>
                  {formatTimeInLocation(moonRiseSet.set)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* The Dial */}
      <div className='in-flow-dark__dial'>
        <div className='in-flow-dark__section-label'>The Dial</div>
        <div className='in-flow-dark__dial-body'>
          <ConstellationSVG
            name={constellation.name}
            width={180}
            height={108}
          />
          <div className='in-flow-dark__dial-text'>
            <span className='in-flow-dark__dial-name'>
              The sun is in {constellation.name}
            </span>
            <span className='in-flow-dark__dial-desc'>{dialObservable}</span>
          </div>
        </div>
      </div>

      {/* Wanderers */}
      <div className='in-flow-dark__wanderers'>
        <div className='in-flow-dark__section-label'>Wanderers</div>
        {wanderers.length === 0 ? (
          <p className='in-flow-dark__wanderers-empty'>
            No naked-eye planets are well-placed in the sky tonight from
            Melbourne.
          </p>
        ) : (
          <ul className='in-flow-dark__wanderers-list'>
            {wanderers.map((w) => (
              <li key={w.name} className='in-flow-dark__wanderer'>
                <StarIcon size={14} className='in-flow-dark__wanderer-icon' />
                <span className='in-flow-dark__wanderer-name'>{w.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
