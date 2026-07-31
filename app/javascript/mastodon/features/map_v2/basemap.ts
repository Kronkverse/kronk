import { layers, LIGHT } from '@protomaps/basemaps';
import * as maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';

// Shared Kronk basemap — the self-hosted OSM Protomaps .pmtiles in DO Spaces
// (no third-party map provider) plus the "Midnight Violet" Kronk palette. Used
// by every Map lens (Mates, Treks, …) so they render identically.
//
// Label (symbol) layers are dropped — they'd need externally-hosted glyphs.

export const BASEMAP_URL =
  'pmtiles://https://kronk-osm.syd1.digitaloceanspaces.com/planet.pmtiles';

// Default view — open on Australia.
export const HOME_CENTER: [number, number] = [134, -25.5];
export const HOME_ZOOM = 3.7;

// "Midnight Violet" — dark-violet land under white roads, a cornflower water
// that reads clearly against them, and a Kronk-violet bushland. Landuse patches
// blend into the land; the natural landcover overlay is recoloured to the
// bushland tone at render time (see basemapLayers).
const LAND = '#5f4a96';
const BUSHLAND_COLOR = '#6f5ab2';
// Dark-violet used for admin borders — well below the land value so the dashed
// boundary lines stand out against both the land and the near-white roads.
const BORDER_COLOR = '#241a42';

export const KRONK_FLAVOR = {
  ...LIGHT,
  background: '#8f7bc8', // sea
  earth: LAND, // land
  water: '#6b82d4', // cornflower
  park_a: BUSHLAND_COLOR,
  park_b: BUSHLAND_COLOR,
  wood_a: BUSHLAND_COLOR,
  wood_b: BUSHLAND_COLOR,
  scrub_a: BUSHLAND_COLOR,
  scrub_b: BUSHLAND_COLOR,
  pedestrian: BUSHLAND_COLOR,
  zoo: BUSHLAND_COLOR,
  glacier: LAND,
  sand: LAND,
  beach: LAND,
  hospital: LAND,
  industrial: LAND,
  school: LAND,
  military: LAND,
  aerodrome: LAND,
  buildings: '#d9ccef',
  // Admin borders are recoloured + dashed in basemapLayers() so they read as
  // borders, not another road; this base tone is the dark-violet they use.
  boundaries: BORDER_COLOR,
  railway: '#b3a4dd',
  major: '#ffffff',
  minor_a: '#ffffff',
  minor_b: '#f7f3fd',
  highway: '#efe7fc',
  major_casing_early: '#ccbde9',
  major_casing_late: '#ccbde9',
  highway_casing_early: '#c1b1e4',
  highway_casing_late: '#c1b1e4',
  other: '#efe9f6',
  minor_service: '#f7f3fd',
  link: '#f2ecfb',
};

// The Protomaps layer set with symbol (label) layers dropped and the natural
// landcover overlay recoloured to the Kronk bushland tone.
export const basemapLayers = () => {
  const built = layers('protomaps', KRONK_FLAVOR, { lang: 'en' }).filter(
    (layer) => layer.type !== 'symbol',
  );
  built.forEach((layer) => {
    if (layer.type === 'fill' && layer['source-layer'] === 'landcover') {
      layer.paint = {
        ...layer.paint,
        'fill-color': BUSHLAND_COLOR,
        'fill-opacity': 0.5,
      };
    }

    // Make administrative borders obvious and distinct from the (white) roads:
    // a dark-violet DASHED line, widened with zoom. The dash is the cartographic
    // "this is a border" signal — roads stay solid white, borders read as borders.
    if (layer.type === 'line' && layer['source-layer'] === 'boundaries') {
      layer.paint = {
        ...layer.paint,
        'line-color': BORDER_COLOR,
        'line-opacity': 0.95,
        'line-dasharray': [2, 1.5],
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          3,
          1.4,
          8,
          2.4,
          14,
          3.2,
        ],
      };
    }
  });
  return built;
};

// Register the pmtiles protocol with MapLibre exactly once per page.
let pmtilesRegistered = false;
export const ensurePmtilesProtocol = () => {
  if (pmtilesRegistered) return;
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  pmtilesRegistered = true;
};
