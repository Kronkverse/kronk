import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import type { Feature, Polygon } from 'geojson';
import * as maplibregl from 'maplibre-gl';

import 'maplibre-gl/dist/maplibre-gl.css';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import GroupIcon from '@/material-icons/400-24px/groups.svg?react';
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

// Map — Mates lens. Native MapLibre GL rendering opt-in, coarsened
// presence pins (docs/spaces/map.md). Basemap is the self-hosted OSM
// Protomaps .pmtiles in DO Spaces — no third-party map provider is
// contacted. Presence is polled, not streamed.
//
// Pin treatment (Tal 2026-08-10):
//   * Teardrop-shaped marker (LocationOn-style) with the account's
//     avatar clipped into the bulb — see `.map-teardrop` in _map.scss.
//   * Clustering: when two or more pins would render within
//     CLUSTER_PX of each other on screen, they collapse into a
//     single "N here" cluster marker. Recomputed on move / zoom.
//   * Privacy anonymisation: at zoom >= ANON_ZOOM (city-block close),
//     precise pins hide entirely and a floating "N mates in view"
//     panel takes over, opening a dropdown of avatar bubbles for the
//     mates currently inside the viewport. That way a screenshot of a
//     tight zoom can never reveal a specific address.

const messages = defineMessages({
  removeMe: { id: 'map.remove_me', defaultMessage: 'Remove me from the map' },
  hereN: {
    id: 'map.cluster.here',
    defaultMessage: '{count} here',
  },
  inViewToggle: {
    id: 'map.in_view.toggle',
    defaultMessage: '{count, plural, one {# mate} other {# mates}} in view',
  },
  inViewEmpty: {
    id: 'map.in_view.empty',
    defaultMessage: 'No mates in view. Zoom out.',
  },
});

const POLL_MS = 30_000;
// Two pins whose projected pixel positions are within this many CSS
// pixels of each other collapse into a single cluster marker.
const CLUSTER_PX = 56;
// Zoom threshold above which precise pins hide and the "in view" panel
// takes over. 11 ≈ metropolitan area — anything closer is neighbourhood
// / street-scale and precise enough to be personally identifying.
const ANON_ZOOM = 11;

// GeoJSON polygon approximating the honest-fuzz circle drawn under each
// pin at wider zooms. Above ANON_ZOOM the circle layer is also hidden.
const circleFeature = (pin: ApiPresencePinJSON): Feature<Polygon> => {
  const points = 48;
  const coords: [number, number][] = [];
  const latR = pin.radius / 111_320;
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

// A cluster: an anchor lng/lat (mean of members) + the pins that
// contribute to it. Solo clusters (one member) render as a teardrop;
// 2+ render as a "N here" cluster marker.
interface Cluster {
  key: string;
  lng: number;
  lat: number;
  pins: ApiPresencePinJSON[];
}

// Group pins by projected pixel proximity. Greedy: for each pin, find
// the first existing cluster within CLUSTER_PX and join, else start a
// new cluster. Self is always seeded first so it becomes the anchor of
// its group (keeps "you" at the top of the mate list in that cluster).
const clusterPins = (
  map: maplibregl.Map,
  pins: ApiPresencePinJSON[],
): Cluster[] => {
  const clusters: (Cluster & { px: { x: number; y: number } })[] = [];
  for (const pin of pins) {
    const px = map.project([pin.lng, pin.lat]);
    const nearest = clusters.find((c) => {
      const dx = c.px.x - px.x;
      const dy = c.px.y - px.y;
      return Math.hypot(dx, dy) <= CLUSTER_PX;
    });
    if (nearest) {
      nearest.pins.push(pin);
      const n = nearest.pins.length;
      nearest.lng = (nearest.lng * (n - 1) + pin.lng) / n;
      nearest.lat = (nearest.lat * (n - 1) + pin.lat) / n;
      nearest.px = map.project([nearest.lng, nearest.lat]);
    } else {
      clusters.push({
        key: pin.account_id,
        lng: pin.lng,
        lat: pin.lat,
        pins: [pin],
        px,
      });
    }
  }
  // Strip the pixel bookkeeping before returning; consumers only need
  // {key, lng, lat, pins}.
  return clusters.map(({ key, lng, lat, pins }) => ({ key, lng, lat, pins }));
};

// Build the DOM element for a solo teardrop marker. Vanilla DOM (not
// React) because MapLibre owns the container's positioning and there's
// no state on the pin itself — hover / focus are CSS.
const buildTeardrop = (pin: ApiPresencePinJSON, title: string): HTMLElement => {
  const el = document.createElement('div');
  el.className = `map-teardrop${pin.self ? ' map-teardrop--self' : ''}`;
  el.title = title;
  const avatar = document.createElement('div');
  avatar.className = 'map-teardrop__avatar';
  avatar.style.backgroundImage = `url("${pin.avatar}")`;
  el.appendChild(avatar);
  return el;
};

// Build the DOM element for a cluster marker showing the member count.
const buildCluster = (count: number, title: string): HTMLElement => {
  const el = document.createElement('div');
  el.className = 'map-cluster';
  el.title = title;
  const num = document.createElement('span');
  num.className = 'map-cluster__count';
  num.textContent = count.toString();
  el.appendChild(num);
  return el;
};

export const MatesView: React.FC = () => {
  const intl = useIntl();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [pins, setPins] = useState<ApiPresencePinJSON[]>([]);
  const [selfPin, setSelfPin] = useState<ApiPresencePinJSON | null>(null);
  // Viewport state — updated on every move/zoom so the render pass
  // knows whether to anonymise and what pixel positions to cluster on.
  const [viewport, setViewport] = useState<{
    zoom: number;
    bounds: maplibregl.LngLatBounds | null;
  }>({ zoom: HOME_ZOOM, bounds: null });
  const [inViewOpen, setInViewOpen] = useState(false);

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

    const emitViewport = () => {
      setViewport({ zoom: map.getZoom(), bounds: map.getBounds() });
    };

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
      emitViewport();
      setReady(true);
    });
    map.on('moveend', emitViewport);
    map.on('zoomend', emitViewport);
    mapRef.current = map;

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

  // Union of mates + my own pin (deduplicated) — the working set for
  // every render pass below.
  const allPins = useMemo(
    () =>
      selfPin
        ? [...pins.filter((p) => p.account_id !== selfPin.account_id), selfPin]
        : pins,
    [pins, selfPin],
  );

  // Which pins fall inside the current viewport? Used both by the
  // in-view panel and to decide whether to draw them at all.
  const pinsInView = useMemo(() => {
    const bounds = viewport.bounds;
    if (!bounds) return allPins;
    return allPins.filter((p) => bounds.contains([p.lng, p.lat]));
  }, [allPins, viewport]);

  const anonymising = viewport.zoom >= ANON_ZOOM;

  // ── Render markers + fuzz circles ─────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    // Tear down every previous marker up-front so a state transition
    // (e.g. entering anonymised zoom) reliably clears the map.
    markersRef.current.forEach((m) => {
      m.remove();
    });
    markersRef.current = [];

    // Anonymised zoom: no map markers at all. The in-view panel below
    // takes over as the only surface a viewer can inspect. The fuzz
    // layer also empties so a screenshot at this zoom shows nothing
    // pin-shaped.
    if (anonymising) {
      const source = map.getSource<maplibregl.GeoJSONSource>('fuzz');
      void source?.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const clusters = clusterPins(map, allPins);
    markersRef.current = clusters.map((cluster) => {
      const [firstPin] = cluster.pins;
      const isSolo = cluster.pins.length === 1 && firstPin !== undefined;
      let el: HTMLElement;
      if (isSolo) {
        const title = firstPin.label
          ? `${firstPin.name} · ${firstPin.label}`
          : firstPin.name;
        el = buildTeardrop(firstPin, title);
      } else {
        const title = cluster.pins.map((p) => p.name).join(', ');
        el = buildCluster(cluster.pins.length, title);
        el.addEventListener('click', () => {
          const currentZoom = map.getZoom();
          map.flyTo({
            center: [cluster.lng, cluster.lat],
            zoom: Math.min(currentZoom + 2, ANON_ZOOM - 0.5),
            duration: 600,
          });
        });
      }
      return new maplibregl.Marker({ element: el })
        .setLngLat([cluster.lng, cluster.lat])
        .addTo(map);
    });

    const source = map.getSource<maplibregl.GeoJSONSource>('fuzz');
    void source?.setData({
      type: 'FeatureCollection',
      features: allPins.map(circleFeature),
    });
  }, [allPins, ready, anonymising, viewport]);

  // ── Place / remove me ─────────────────────────────────────────────
  const handlePlaced = useCallback(
    (pin: ApiPresencePinJSON) => {
      setSelfPin(pin);
      // Fly to a zoom that STAYS below ANON_ZOOM — otherwise dropping
      // a pin would immediately hide it under the anonymisation gate.
      mapRef.current?.flyTo({
        center: [pin.lng, pin.lat],
        zoom: Math.min(9, ANON_ZOOM - 1),
      });
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

  const handleSelectPin = useCallback((pin: ApiPresencePinJSON) => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center: [pin.lng, pin.lat],
      zoom: Math.min(Math.max(map.getZoom(), 9), ANON_ZOOM - 0.5),
      duration: 900,
    });
  }, []);

  const toggleInView = useCallback(() => {
    setInViewOpen((v) => !v);
  }, []);
  const closeInView = useCallback(() => {
    setInViewOpen(false);
  }, []);

  return (
    <div className='map-mates'>
      <PeopleStrip pins={pins} selfPin={selfPin} onSelect={handleSelectPin} />
      <div className='map-mates__stage'>
        <div ref={containerRef} className='map-mates__canvas' />

        {/* At close zoom, the on-map markers hide and this panel is the
            only affordance for finding a mate. A drop-down of avatar
            bubbles opens on click. Sits top-left so it doesn't fight
            the zoom controls on the right. */}
        {anonymising && (
          <InViewPanel
            pins={pinsInView}
            open={inViewOpen}
            onToggle={toggleInView}
            onSelect={handleSelectPin}
            onClose={closeInView}
            intl={intl}
          />
        )}

        {/* Bottom-left place control: either "remove me" (when I have
            a pin) or the search-a-place FAB. */}
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

// ── In-view mates panel ─────────────────────────────────────────────
// At close zoom, precise pins hide. This surface takes over: a
// count pill that expands into a dropdown of avatar bubbles. Each
// bubble tap re-centres the map on that mate (still clamped to
// ANON_ZOOM - 0.5 by handleSelectPin so the anonymisation stays
// respected).

const InViewRow: React.FC<{
  pin: ApiPresencePinJSON;
  onSelect: (pin: ApiPresencePinJSON) => void;
}> = ({ pin, onSelect }) => {
  const handleClick = useCallback(() => {
    onSelect(pin);
  }, [pin, onSelect]);
  return (
    <button
      type='button'
      className={`map-in-view__row${pin.self ? ' map-in-view__row--self' : ''}`}
      onClick={handleClick}
    >
      <span
        className='map-in-view__avatar'
        style={{ backgroundImage: `url("${pin.avatar}")` }}
      />
      <span className='map-in-view__name'>{pin.name}</span>
      <span className='map-in-view__handle'>@{pin.handle}</span>
    </button>
  );
};

interface InViewPanelProps {
  pins: ApiPresencePinJSON[];
  open: boolean;
  onToggle: () => void;
  onSelect: (pin: ApiPresencePinJSON) => void;
  onClose: () => void;
  intl: ReturnType<typeof useIntl>;
}

const InViewPanel: React.FC<InViewPanelProps> = ({
  pins,
  open,
  onToggle,
  onSelect,
  onClose,
  intl,
}) => {
  const count = pins.length;
  const handleSelectAndClose = useCallback(
    (pin: ApiPresencePinJSON) => {
      onSelect(pin);
      onClose();
    },
    [onSelect, onClose],
  );
  return (
    <div className='map-in-view'>
      <button
        type='button'
        className='map-in-view__toggle'
        onClick={onToggle}
        aria-expanded={open}
      >
        <Icon id='groups' icon={GroupIcon} />
        <span>{intl.formatMessage(messages.inViewToggle, { count })}</span>
      </button>
      {open && (
        <div className='map-in-view__panel' role='listbox'>
          {count === 0 ? (
            <p className='map-in-view__empty'>
              <FormattedMessage {...messages.inViewEmpty} />
            </p>
          ) : (
            pins.map((pin) => (
              <InViewRow
                key={pin.account_id}
                pin={pin}
                onSelect={handleSelectAndClose}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};
