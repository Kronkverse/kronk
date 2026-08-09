import { useEffect, useRef, useState, useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type { Feature, Polygon } from 'geojson';
import * as maplibregl from 'maplibre-gl';

import 'maplibre-gl/dist/maplibre-gl.css';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import {
  apiGetPresence,
  apiGetSelfPresence,
  apiRemovePresence,
} from 'mastodon/api/map';
import type { ApiPresencePinJSON } from 'mastodon/api/map';
import { Icon } from 'mastodon/components/icon';

import {
  BASEMAP_URL,
  HOME_CENTER,
  HOME_ZOOM,
  basemapLayers,
  ensurePmtilesProtocol,
} from './basemap';
import { PeopleStrip } from './people_strip';
import { PlaceControl } from './place_control';

// Map — Mates lens. A native MapLibre GL map rendering opt-in, coarsened
// presence pins (docs/spaces/map.md). The basemap is the self-hosted OSM
// Protomaps .pmtiles in DO Spaces — no third-party map provider is contacted.
// Labels are omitted in this first cut (they'd need externally-hosted glyphs);
// geography, roads and pins render. Presence is polled, not streamed.

const messages = defineMessages({
  removeMe: { id: 'map.remove_me', defaultMessage: 'Remove me from the map' },
});

const POLL_MS = 30_000;

// A GeoJSON polygon approximating a circle of `radiusM` metres — the honest
// fuzz radius drawn under each pin.
const circleFeature = (pin: ApiPresencePinJSON): Feature<Polygon> => {
  const points = 48;
  const coords: [number, number][] = [];
  const latR = pin.radius / 111_320; // deg latitude per metre
  const lngR = pin.radius / (111_320 * Math.cos((pin.lat * Math.PI) / 180));
  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * 2 * Math.PI;
    coords.push([
      pin.lng + lngR * Math.cos(theta),
      pin.lat + latR * Math.sin(theta),
    ]);
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

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'top-right',
    );
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
        paint: {
          'line-color': '#7c5cff',
          'line-opacity': 0.4,
          'line-width': 1,
        },
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
    void apiGetPresence()
      .then(setPins)
      .catch(() => undefined);
    void apiGetSelfPresence()
      .then(setSelfPin)
      .catch(() => undefined);
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
      const popup = new maplibregl.Popup({
        offset: 16,
        closeButton: false,
      }).setText(pin.label ? `${pin.name} · ${pin.label}` : pin.name);
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
  // Placing lives in <PlaceControl>; when it returns a pin, fly to it
  // and refresh so the mates projection picks it up on the next poll.
  const handlePlaced = useCallback(
    (pin: ApiPresencePinJSON) => {
      setSelfPin(pin);
      mapRef.current?.flyTo({ center: [pin.lng, pin.lat], zoom: 11 });
      refresh();
    },
    [refresh],
  );

  const remove = useCallback(() => {
    void apiRemovePresence().then(() => {
      setSelfPin(null);
      refresh();
    });
  }, [refresh]);

  // Centre the map on a person tapped in the people strip.
  const handleSelectPin = useCallback((pin: ApiPresencePinJSON) => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center: [pin.lng, pin.lat],
      zoom: Math.max(map.getZoom(), 9),
      duration: 900,
    });
  }, []);

  return (
    <div className='map-mates'>
      <PeopleStrip pins={pins} selfPin={selfPin} onSelect={handleSelectPin} />
      <div className='map-mates__stage'>
        <div ref={containerRef} className='map-mates__canvas' />

        {/* Bottom-left place control: either the "remove me" pill (when
            I already have a pin) or the search-a-place FAB. Placing and
            removing are the two states, and only one shows at a time. */}
        <div className='map-mates__place-slot'>
          {selfPin ? (
            <button
              type='button'
              className='place-control__remove'
              onClick={remove}
              aria-label={intl.formatMessage(messages.removeMe)}
              title={intl.formatMessage(messages.removeMe)}
            >
              <Icon id='close' icon={CloseIcon} />
            </button>
          ) : (
            <PlaceControl onPlaced={handlePlaced} />
          )}
        </div>
      </div>
    </div>
  );
};
