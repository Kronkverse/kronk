import { useState, useMemo, useEffect, useCallback } from 'react';

import { Link } from 'react-router-dom';

import {
  getMoonIllumination,
  getMoonPhaseName,
  getMoonRiseSet,
  getDaylightInfo,
} from 'mastodon/features/events/components/celestial_calendar';

import { buildDailyIntegrationText } from './components/daily_integration';
import { getDailyObservable, getEarthMonth } from './components/earth_calendar';
import { LOCATION_LAT, LOCATION_LON, LOCATION_TZ } from './constants';

// The InFlow feed card — an inline post-like card that replaces the VeilScene
// aperture in the home feed. One tab is visible at a time (Ecos ↔ Kosmos);
// the flip button and persisted preference decide which.
//
// Ecos: local ecosystem observation + what to sow/harvest this month.
// Kosmos: moon phase + the daily integrated reading.

type Tab = 'ecos' | 'kosmos';

const TAB_KEY = 'kronk.inflow.tab';

function readTab(): Tab {
  try {
    const v =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem(TAB_KEY)
        : null;
    if (v === 'ecos' || v === 'kosmos') return v;
  } catch {
    // silent
  }
  return 'kosmos';
}

function writeTab(tab: Tab): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(TAB_KEY, tab);
  } catch {
    // silent
  }
}

function nowInMelbourne(): {
  year: number;
  month: number; // 1-indexed — matches celestial_calendar conventions
  day: number;
  now: Date;
} {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: LOCATION_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string): number =>
    parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
  return { year: get('year'), month: get('month'), day: get('day'), now };
}

function fmtTime(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleTimeString('en-AU', {
    timeZone: LOCATION_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  });
}

function fmtPhase(name: string): string {
  return name
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export const InflowCard: React.FC = () => {
  const [tab, setTab] = useState<Tab>(readTab);
  const [agentObservation, setAgentObservation] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/v1/in_flow/observation')
      .then((r) => r.json())
      .then((d: { text?: string | null }) => {
        if (d.text) setAgentObservation(d.text);
      })
      .catch(() => {
        // silent — falls back to earth_calendar observable
      });
  }, []);

  const sky = useMemo(() => {
    const { year, month, day, now } = nowInMelbourne();
    const illum = getMoonIllumination(now);
    return {
      illum,
      phase: getMoonPhaseName(now),
      moon: getMoonRiseSet(year, month, day, LOCATION_LAT, LOCATION_LON),
      daylight: getDaylightInfo(year, month, day, LOCATION_LAT, LOCATION_LON),
      reflection: buildDailyIntegrationText(),
    };
  }, []);

  const earth = useMemo(() => {
    const { month, day } = nowInMelbourne();
    const monthIdx = month - 1; // getEarthMonth uses 0-indexed month
    return {
      data: getEarthMonth(monthIdx),
      observable: getDailyObservable(monthIdx, day),
    };
  }, []);

  const handleFlip = useCallback(() => {
    setTab((prev) => {
      const next: Tab = prev === 'ecos' ? 'kosmos' : 'ecos';
      writeTab(next);
      return next;
    });
  }, []);

  const lit = Math.round(sky.illum * 100);

  return (
    <div className='inflow-card'>
      <div className='inflow-card__header'>
        <Link to='/hub/inflow' className='inflow-card__name'>
          In Flow
        </Link>
        <span className='inflow-card__location'>Narrm</span>
        <button
          type='button'
          className='inflow-card__flip'
          onClick={handleFlip}
          aria-label={`Switch to ${tab === 'ecos' ? 'Kosmos' : 'Ecos'}`}
        >
          {tab === 'ecos' ? 'Kosmos →' : '← Ecos'}
        </button>
      </div>

      {tab === 'ecos' ? (
        <div className='inflow-card__body inflow-card__body--ecos'>
          <div className='inflow-card__season'>{earth.data.season}</div>
          <p className='inflow-card__observable'>
            {agentObservation ?? earth.observable}
          </p>
          {(earth.data.sow.length > 0 || earth.data.harvest.length > 0) && (
            <div className='inflow-card__garden'>
              {earth.data.sow.length > 0 && (
                <span>
                  Sow:{' '}
                  <span className='inflow-card__garden-items'>
                    {earth.data.sow.join(', ')}
                  </span>
                </span>
              )}
              {earth.data.harvest.length > 0 && (
                <span>
                  Harvest:{' '}
                  <span className='inflow-card__garden-items'>
                    {earth.data.harvest.join(', ')}
                  </span>
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className='inflow-card__body inflow-card__body--kosmos'>
          <div className='inflow-card__phase'>
            {fmtPhase(sky.phase)} · {lit}%
          </div>
          <p className='inflow-card__reflection'>{sky.reflection}</p>
          <div className='inflow-card__almanac'>
            <span>
              Moonrise <b>{fmtTime(sky.moon.rise)}</b>
            </span>
            <span>
              Moonset <b>{fmtTime(sky.moon.set)}</b>
            </span>
            <span>
              Sunrise <b>{fmtTime(sky.daylight.rise)}</b>
            </span>
            <span>
              Sunset <b>{fmtTime(sky.daylight.set)}</b>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
