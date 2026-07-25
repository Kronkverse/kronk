import { useEffect, useRef, useState, useCallback } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { layers, LIGHT } from '@protomaps/basemaps';
import type { Feature, Polygon } from 'geojson';
import * as maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';

import 'maplibre-gl/dist/maplibre-gl.css';

import {
  apiGetPresence,
  apiGetSelfPresence,
  apiPlacePresence,
  apiRemovePresence,
} from 'mastodon/api/map';
import type { ApiPresencePinJSON, MapPrecision } from 'mastodon/api/map';
import { Button } from 'mastodon/components/button';
import { LoadingIndicator } from 'mastodon/components/loading_indicator';

// Map — Mates lens. A native MapLibre GL map rendering opt-in, coarsened
// presence pins (docs/spaces/map.md). The basemap is the self-hosted OSM
// Protomaps .pmtiles in DO Spaces — no third-party map provider is contacted.
// Labels are omitted in this first cut (they'd need externally-hosted glyphs);
// geography, roads and pins render. Presence is polled, not streamed.

const messages = defineMessages({
  placeMe: { id: 'map.place_me', defaultMessage: 'Place me on the map' },
  updateMe: { id: 'map.update_me', defaultMessage: 'Update my spot' },
  removeMe: { id: 'map.remove_me', defaultMessage: 'Remove me' },
  hood: { id: 'map.precision.hood', defaultMessage: 'Neighbourhood' },
  city: { id: 'map.precision.city', defaultMessage: 'City' },
  locating: { id: 'map.locating', defaultMessage: 'Finding you…' },
  geoError: {
    id: 'map.geo_error',
    defaultMessage: "Couldn't get your location — check the browser permission.",
  },
});

const BASEMAP_URL =
  'pmtiles://https://kronk-osm.syd1.digitaloceanspaces.com/planet.pmtiles';
const POLL_MS = 30_000;

// Default view — open on Australia.
const HOME_CENTER: [number, number] = [134, -25.5];
const HOME_ZOOM = 3.7;

// Kronk basemap flavor: a lightened, purple palette so the map reads as a
// Kronk surface rather than a stock dark basemap. Built on the Protomaps
// LIGHT flavor with the visible fields shifted to lavender/purple. The
// natural `landcover` layer (hardcoded greens) is dropped at render time so
// the land stays lavender.
// "Midnight Violet" — a dark-violet land under white roads, a cornflower
// water that reads clearly against them, and a Kronk-violet bushland. Landuse
// patches blend into the land; the natural landcover overlay is recoloured to
// the bushland tone at render time (see BUSHLAND_COLOR / basemapLayers).
const LAND = '#5f4a96';
const BUSHLAND_COLOR = '#6f5ab2';
const KRONK_FLAVOR = {
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
  boundaries: '#d8cbf0',
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
const basemapLayers = () => {
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
  });
  return built;
};

// Register the pmtiles protocol with MapLibre exactly once per page.
let pmtilesRegistered = false;
const ensurePmtilesProtocol = () => {
  if (pmtilesRegistered) return;
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  pmtilesRegistered = true;
};

// A GeoJSON polygon approximating a circle of `radiusM` metres — the honest
// fuzz radius drawn under each pin.
const circleFeature = (pin: ApiPresencePinJSON): Feature<Polygon> => {
  const points = 48;
  const coords: [number, number][] = [];
  const latR = pin.radius / 111_320; // deg latitude per metre
  const lngR = pin.radius / (111_320 * Math.cos((pin.lat * Math.PI) / 180));
  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * 2 * Math.PI;
    coords.push([pin.lng + lngR * Math.cos(theta), pin.lat + latR * Math.sin(theta)]);
  }
  return {
    type: 'Feature',
    properties: { self: pin.self },
    geometry: { type: 'Polygon', coordinates: [coords] },
  };
};

export const MatesView: React.FC = () => {
  const intl = useIntl();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [pins, setPins] = useState<ApiPresencePinJSON[]>([]);
  const [selfPin, setSelfPin] = useState<ApiPresencePinJSON | null>(null);
  const [placing, setPlacing] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Map init ──────────────────────────────────────────────────────
  useEffect(() => {
    ensurePmtilesProtocol();
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const map = new maplibregl.Map({
      container,
      center: HOME_CENTER,
      zoom: HOME_ZOOM,
      attributionControl: { compact: true },
      style: {
        version: 8,
        sources: {
          protomaps: {
            type: 'vector',
            url: BASEMAP_URL,
            attribution: '© OpenStreetMap',
          },
        },
        layers: basemapLayers(),
      },
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => {
      map.addSource('fuzz', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'fuzz-fill',
        type: 'fill',
        source: 'fuzz',
        paint: { 'fill-color': '#7c5cff', 'fill-opacity': 0.12 },
      });
      map.addLayer({
        id: 'fuzz-line',
        type: 'line',
        source: 'fuzz',
        paint: { 'line-color': '#7c5cff', 'line-opacity': 0.4, 'line-width': 1 },
      });
      setReady(true);
    });
    mapRef.current = map;

    // The Stage resolves the container height via flex *after* this effect
    // runs, so the map would otherwise stay at MapLibre's 300px fallback and
    // render nothing. Observe the container and resize the map to fill it.
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  // ── Fetch + poll presence ─────────────────────────────────────────
  const refresh = useCallback(() => {
    void apiGetPresence().then(setPins).catch(() => undefined);
    void apiGetSelfPresence().then(setSelfPin).catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, POLL_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [refresh]);

  // ── Render pins (markers) + fuzz circles ──────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const all = selfPin
      ? [...pins.filter((p) => p.account_id !== selfPin.account_id), selfPin]
      : pins;

    markersRef.current.forEach((marker) => {
      marker.remove();
    });
    markersRef.current = all.map((pin) => {
      const el = document.createElement('div');
      el.className = `map-pin ${pin.self ? 'map-pin--self' : ''}`;
      const popup = new maplibregl.Popup({ offset: 16, closeButton: false }).setText(
        pin.label ? `${pin.name} · ${pin.label}` : pin.name,
      );
      return new maplibregl.Marker({ element: el })
        .setLngLat([pin.lng, pin.lat])
        .setPopup(popup)
        .addTo(map);
    });

    const source = map.getSource<maplibregl.GeoJSONSource>('fuzz');
    void source?.setData({
      type: 'FeatureCollection',
      features: all.map(circleFeature),
    });
  }, [pins, selfPin, ready]);

  // ── Place / remove me ─────────────────────────────────────────────
  const place = useCallback(
    (precision: MapPrecision) => {
      setError(null);
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          void apiPlacePresence({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            precision,
            share_scope: 'friends',
          })
            .then((pin) => {
              setSelfPin(pin);
              mapRef.current?.flyTo({ center: [pin.lng, pin.lat], zoom: 11 });
              refresh();
            })
            .finally(() => {
              setLocating(false);
              setPlacing(false);
            });
        },
        () => {
          setError(intl.formatMessage(messages.geoError));
          setLocating(false);
        },
        { enableHighAccuracy: false, timeout: 15_000 },
      );
    },
    [intl, refresh],
  );

  const remove = useCallback(() => {
    void apiRemovePresence().then(() => {
      setSelfPin(null);
      refresh();
    });
  }, [refresh]);

  const startPlacing = useCallback(() => {
    setPlacing(true);
  }, []);
  const placeHood = useCallback(() => {
    place('hood');
  }, [place]);
  const placeCity = useCallback(() => {
    place('city');
  }, [place]);

  return (
    <div className='map-mates'>
      <div ref={containerRef} className='map-mates__canvas' />

      <div className='map-mates__panel'>
        {locating && (
          <span className='map-mates__status'>
            <LoadingIndicator />
            <FormattedMessage {...messages.locating} />
          </span>
        )}
        {error && <span className='map-mates__error'>{error}</span>}

        {selfPin ? (
          <>
            <Button secondary onClick={startPlacing}>
              {intl.formatMessage(messages.updateMe)}
            </Button>
            <Button className='button--destructive' onClick={remove}>
              {intl.formatMessage(messages.removeMe)}
            </Button>
          </>
        ) : placing ? (
          <>
            <span className='map-mates__prompt'>
              <FormattedMessage id='map.pick_precision' defaultMessage='Show me at:' />
            </span>
            <Button secondary onClick={placeHood}>
              {intl.formatMessage(messages.hood)}
            </Button>
            <Button secondary onClick={placeCity}>
              {intl.formatMessage(messages.city)}
            </Button>
          </>
        ) : (
          <Button onClick={startPlacing}>
            {intl.formatMessage(messages.placeMe)}
          </Button>
        )}
      </div>
    </div>
  );
};
