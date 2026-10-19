import { useEffect, useState } from 'react';

import { apiGetSelfPresence } from 'mastodon/api/map';

import { LOCATION_LAT, LOCATION_LON, LOCATION_TZ } from './constants';

// Where Inflow reads the sky from (Tal 2026-10-17: "Standard is melbourne,
// if you've got a location in Map, it uses that"). Melbourne until your own
// Map pin is known; then the pin's point, which the server has already
// coarsened, so the sky is right to the suburb or the city and no closer.
//
// A pin has no time zone, so the day boundary and the times shown follow
// your device's zone once the pin is in use: you are almost always where
// your device is. Without a pin it stays Melbourne's, matching its sky.

export interface SkyPlace {
  lat: number;
  lon: number;
  tz: string;
}

const MELBOURNE: SkyPlace = {
  lat: LOCATION_LAT,
  lon: LOCATION_LON,
  tz: LOCATION_TZ,
};

let current: SkyPlace = MELBOURNE;
let loading: Promise<SkyPlace> | null = null;

const deviceZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || LOCATION_TZ;
  } catch {
    return LOCATION_TZ;
  }
};

// The place as known right now. Synchronous, for the formatters.
export const skyPlace = (): SkyPlace => current;

// Asks once per page load. No pin, signed out, or an error: Melbourne.
const loadSkyPlace = (): Promise<SkyPlace> => {
  loading ??= apiGetSelfPresence()
    .then((pin) => {
      current = pin
        ? { lat: pin.lat, lon: pin.lng, tz: deviceZone() }
        : MELBOURNE;
      return current;
    })
    .catch(() => MELBOURNE);
  return loading;
};

// The place, re-rendering once your pin has been looked up.
export const useSkyPlace = (): SkyPlace => {
  const [place, setPlace] = useState<SkyPlace>(current);
  useEffect(() => {
    let live = true;
    void loadSkyPlace().then((next) => {
      if (live) setPlace(next);
    });
    return () => {
      live = false;
    };
  }, []);
  return place;
};
