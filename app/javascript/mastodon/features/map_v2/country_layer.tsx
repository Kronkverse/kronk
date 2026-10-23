import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type * as maplibregl from 'maplibre-gl';

import countryMapUrl from '@/images/first-nations-country.webp';

// First Nations Country — a map of the Countries of Aboriginal and Torres
// Strait Islander peoples laid over Australia, switched on and off from the
// Map (Kommons "Introduce First nation country display", 2026-10-23).
//
// The picture is @mangobee's own map, shown with their permission for
// education. It was drawn in a Lambert conformal conic projection (standard
// parallels -18° and -36°); it was fitted to 21 towns marked on it (about 4px,
// a few km, off on average) and re-drawn into web mercator so MapLibre can lay
// it flat over these bounds, with the white paper taken out by colour-to-alpha
// so the letters keep no white fringe. The original is on the proposal.
const COUNTRY_BOUNDS: [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
] = [
  [111.5, -8.8], // top left
  [155.0, -8.8], // top right
  [155.0, -44.6], // bottom right
  [111.5, -44.6], // bottom left
];

const SOURCE_ID = 'first-nations-country';
const LAYER_ID = 'first-nations-country';

// Under the Mates' fuzz circles and pins, over the basemap.
const BENEATH = 'fuzz-fill';

// The picture carries its own calm: the Country colours are baked in at 75%
// while the names, town dots and coastline stay at full strength, so the words
// read without the colour shouting. It holds its names down to state level;
// past that it is blur, so it fades out and the streets come back.
const OPACITY: maplibregl.ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  7,
  1,
  9,
  0,
];

const STORAGE_KEY = 'kronk.map.country_layer';

const messages = defineMessages({
  show: {
    id: 'map.country.show',
    defaultMessage: 'First Nations Country',
  },
  hide: {
    id: 'map.country.hide',
    defaultMessage: 'Hide First Nations Country',
  },
  credit: {
    id: 'map.country.credit',
    defaultMessage: 'Country map by @mangobee.',
  },
  disclaimer: {
    id: 'map.country.disclaimer',
    defaultMessage:
      'Boundaries are approximate. Country, its names and its borders are held by its peoples.',
  },
});

const readStored = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
};

const writeStored = (on: boolean) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // A private window: the choice lasts the visit.
  }
};

interface Props {
  map: maplibregl.Map | null;
  ready: boolean;
}

export const CountryLayer: React.FC<Props> = ({ map, ready }) => {
  const intl = useIntl();
  const [on, setOn] = useState(readStored);

  // The picture is only fetched once someone turns it on.
  useEffect(() => {
    if (!map || !ready) return;

    if (on && !map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: 'image',
        url: countryMapUrl,
        coordinates: COUNTRY_BOUNDS,
      });
      map.addLayer(
        {
          id: LAYER_ID,
          type: 'raster',
          source: SOURCE_ID,
          paint: { 'raster-opacity': OPACITY, 'raster-fade-duration': 0 },
        },
        map.getLayer(BENEATH) ? BENEATH : undefined,
      );
    }

    if (map.getLayer(LAYER_ID)) {
      map.setLayoutProperty(LAYER_ID, 'visibility', on ? 'visible' : 'none');
    }
  }, [map, ready, on]);

  const toggle = useCallback(() => {
    setOn((was) => {
      writeStored(!was);
      return !was;
    });
  }, []);

  return (
    <div className='map-country'>
      <button
        type='button'
        className={`map-country__toggle${on ? ' map-country__toggle--on' : ''}`}
        aria-pressed={on}
        onClick={toggle}
        title={intl.formatMessage(on ? messages.hide : messages.show)}
      >
        {intl.formatMessage(messages.show)}
      </button>
      {on && (
        <p className='map-country__note'>
          {intl.formatMessage(messages.credit)}{' '}
          {intl.formatMessage(messages.disclaimer)}
        </p>
      )}
    </div>
  );
};
