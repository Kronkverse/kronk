import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import type { Feature, Polygon } from 'geojson';
import * as maplibregl from 'maplibre-gl';

import 'maplibre-gl/dist/maplibre-gl.css';

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
import { EventLayer } from './event_layer';
import { PeopleStrip } from './people_strip';
import { PinCard } from './pin_card';
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
//   * Off-map compass: mates whose pins fall OUTSIDE the current
//     viewport render as small avatar dots pinned to the map's edge,
//     with a chevron indicating the outward direction. Tap → fly the
//     map to that mate. Marks in similar directions collapse to a
//     "+N" pill so a hundred mates in one direction stay legible.
//     Hidden at anonymised zoom (the in-view panel is the only
//     surface then).

const messages = defineMessages({
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
// Off-map compass: marks within this angular distance (radians) collapse
// into a single "+N" pill so a hundred mates in one direction stay
// legible instead of stacking on top of each other.
const COMPASS_CLUSTER_RAD = (18 * Math.PI) / 180;
// Inset from the canvas edge where the compass marks sit. Enough to
// keep the avatar disc fully inside the map frame + not clip the arrow.
const COMPASS_INSET = 26;

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

  // People strip is sorted closest-to-me first when a self-pin exists;
  // otherwise the API's own order is preserved (freshest first, per
  // PresenceController). Cosine-corrected planar distance is fine for
  // ordering — pins are already coarsened, and the pole/date-line
  // pathologies of pure Euclidean don't apply at community-map scale.
  const sortedPins = useMemo(() => {
    if (!selfPin) return pins;
    const anchorLat = selfPin.lat;
    const anchorLng = selfPin.lng;
    const kx = Math.cos((anchorLat * Math.PI) / 180);
    const distSq = (p: ApiPresencePinJSON) => {
      const dx = (p.lng - anchorLng) * kx;
      const dy = p.lat - anchorLat;
      return dx * dx + dy * dy;
    };
    return [...pins].sort((a, b) => distSq(a) - distSq(b));
  }, [pins, selfPin]);
  // Viewport state — updated on every move/zoom so the render pass
  // knows whether to anonymise and what pixel positions to cluster on.
  const [viewport, setViewport] = useState<{
    zoom: number;
    bounds: maplibregl.LngLatBounds | null;
  }>({ zoom: HOME_ZOOM, bounds: null });
  // Canvas size (CSS pixels). Needed to project the off-map compass
  // ray from centre-to-pin onto the canvas edge without dropping the
  // last few pixels off-screen. Populated by the same ResizeObserver
  // that already resizes the map.
  const [canvasSize, setCanvasSize] = useState<{
    w: number;
    h: number;
  } | null>(null);
  const [inViewOpen, setInViewOpen] = useState(false);
  // Whether the place-a-pin panel is open. Owned here (was internal to
  // PlaceControl before the Tal 2026-08-10 rework) so the trigger can
  // live in the people-strip's self-slot instead of a bottom-left FAB.
  const [placeOpen, setPlaceOpen] = useState(false);
  // Which pin's card is open. Stored as account_id + a snapshot so the
  // card can survive a poll refresh: on refresh, if the account_id is
  // still in `allPins`, the shown pin swaps to the fresh copy (so an
  // in-place note edit surfaces); if it's gone, the card closes.
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null,
  );

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

    const resizeObserver = new ResizeObserver((entries) => {
      map.resize();
      const entry = entries[0];
      if (!entry) return;
      const rect = entry.contentRect;
      setCanvasSize({ w: rect.width, h: rect.height });
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

  // Off-map compass marks. Recomputed whenever the viewport, the
  // canvas size, or the pin set changes. Only relevant when we're NOT
  // anonymising — at close zoom the in-view panel is the whole
  // affordance and the compass would just crowd the same information.
  const compassMarks = useMemo(() => {
    const map = mapRef.current;
    const bounds = viewport.bounds;
    if (
      !map ||
      !ready ||
      anonymising ||
      !bounds ||
      !canvasSize ||
      canvasSize.w <= 0 ||
      canvasSize.h <= 0
    ) {
      return [];
    }

    const offPins = allPins.filter((p) => !bounds.contains([p.lng, p.lat]));
    if (offPins.length === 0) return [];

    const { w, h } = canvasSize;
    const cx = w / 2;
    const cy = h / 2;
    const halfW = Math.max(cx - COMPASS_INSET, 1);
    const halfH = Math.max(cy - COMPASS_INSET, 1);

    // Project every off-map pin to a canvas-edge position + angle.
    // `map.project` gives the ideal pixel coord (can be negative or
    // beyond width/height); the ray from centre → that coord hits
    // the inset rectangle at parameter t = min(halfW/|dx|, halfH/|dy|).
    const projected = offPins.map((pin) => {
      const p = map.project([pin.lng, pin.lat]);
      const dx = p.x - cx;
      const dy = p.y - cy;
      const t =
        dx === 0 && dy === 0
          ? 0
          : Math.min(
              dx === 0 ? Infinity : halfW / Math.abs(dx),
              dy === 0 ? Infinity : halfH / Math.abs(dy),
            );
      return {
        pin,
        x: cx + t * dx,
        y: cy + t * dy,
        angle: Math.atan2(dy, dx),
      };
    });

    // Group marks by angle so a bunch of mates in the same direction
    // don't stack into an unreadable pile. Sort first so the greedy
    // walk finds neighbours in constant time.
    projected.sort((a, b) => a.angle - b.angle);
    interface Mark {
      id: string;
      x: number;
      y: number;
      angle: number;
      pins: ApiPresencePinJSON[];
    }
    const groups: Mark[] = [];
    for (const item of projected) {
      const nearest = groups.find(
        (g) => Math.abs(g.angle - item.angle) <= COMPASS_CLUSTER_RAD,
      );
      if (nearest) {
        nearest.pins.push(item.pin);
      } else {
        groups.push({
          id: item.pin.account_id,
          x: item.x,
          y: item.y,
          angle: item.angle,
          pins: [item.pin],
        });
      }
    }
    return groups;
  }, [allPins, viewport, canvasSize, anonymising, ready]);

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
        // Solo pins are the primary tap target for "who is this?" — a
        // click opens the pin card (via the shared select handler so
        // the map still eases toward the pin). The click handler is
        // wired here rather than inside buildTeardrop because the
        // callback needs to reach React state.
        el.addEventListener('click', () => {
          setSelectedAccountId(firstPin.account_id);
          map.flyTo({
            center: [firstPin.lng, firstPin.lat],
            zoom: Math.min(Math.max(map.getZoom(), 9), ANON_ZOOM - 0.5),
            duration: 900,
          });
        });
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
      setPlaceOpen(false); // successful place → dismiss the panel
      // Fly to a zoom that STAYS below ANON_ZOOM — otherwise dropping
      // a pin would immediately hide it under the anonymisation gate.
      mapRef.current?.flyTo({
        center: [pin.lng, pin.lat],
        zoom: Math.min(9, ANON_ZOOM - 1),
      });
      // Open the card so the placer sees confirmation + the "Add a
      // blurb" affordance without a second gesture.
      setSelectedAccountId(pin.account_id);
      refresh();
    },
    [refresh],
  );

  const openPlacePanel = useCallback(() => {
    setPlaceOpen(true);
  }, []);
  const closePlacePanel = useCallback(() => {
    setPlaceOpen(false);
  }, []);

  const removeSelf = useCallback(() => {
    void apiRemovePresence().then(() => {
      setSelfPin(null);
      refresh();
    });
  }, [refresh]);

  const handleSelectPin = useCallback((pin: ApiPresencePinJSON) => {
    setSelectedAccountId(pin.account_id);
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center: [pin.lng, pin.lat],
      zoom: Math.min(Math.max(map.getZoom(), 9), ANON_ZOOM - 0.5),
      duration: 900,
    });
  }, []);

  const closeCard = useCallback(() => {
    setSelectedAccountId(null);
  }, []);

  // Clicking on the map canvas (not a marker — MapLibre only fires
  // `click` for hits that miss overlay DOM) dismisses the card. Same
  // for the ESC key. Keeps the tap-void gesture explicit rather than
  // forcing a hunt for the close button.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.on('click', closeCard);
    return () => {
      map.off('click', closeCard);
    };
  }, [closeCard, ready]);

  useEffect(() => {
    if (!selectedAccountId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCard();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [selectedAccountId, closeCard]);

  // The freshest copy of the currently-selected pin. Recomputes when
  // the poll returns a new snapshot so an in-place note edit surfaces
  // in the open card; drops the card if the account is no longer in
  // view (they removed their pin, or scope changed).
  const selectedPin = useMemo(() => {
    if (!selectedAccountId) return null;
    return allPins.find((p) => p.account_id === selectedAccountId) ?? null;
  }, [allPins, selectedAccountId]);

  useEffect(() => {
    if (selectedAccountId && !selectedPin) setSelectedAccountId(null);
  }, [selectedAccountId, selectedPin]);

  // When the note is saved from the self card, refresh so any external
  // change lands + the card's selected pin swaps to the persisted copy.
  const handleNoteSaved = useCallback(
    (pin: ApiPresencePinJSON) => {
      setSelfPin(pin);
      refresh();
    },
    [refresh],
  );

  const toggleInView = useCallback(() => {
    setInViewOpen((v) => !v);
  }, []);
  const closeInView = useCallback(() => {
    setInViewOpen(false);
  }, []);

  return (
    <div className='map-mates'>
      <PeopleStrip
        pins={sortedPins}
        selfPin={selfPin}
        onSelect={handleSelectPin}
        onOpenPlace={openPlacePanel}
        onRemoveSelf={removeSelf}
      />
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

        {/* Off-map compass overlay — a marker at the canvas edge per
            direction that has mates outside the viewport. Absolute-
            positioned inside the stage; pointer-events are only enabled
            on the marks themselves so the map behind them still pans
            and zooms freely. */}
        {!anonymising && compassMarks.length > 0 && (
          <div className='map-compass' aria-hidden={false}>
            {compassMarks.map((mark) => (
              <CompassMark
                key={mark.id}
                mark={mark}
                onSelect={handleSelectPin}
              />
            ))}
          </div>
        )}

        {/* Place-a-pin panel. Trigger lives in the people-strip's
            self-slot (top-left). Panel renders as an overlay over the
            map when open — self-contained state + auto-clears on
            close. Not rendered when closed. */}
        <PlaceControl
          open={placeOpen}
          onClose={closePlacePanel}
          onPlaced={handlePlaced}
        />

        {/* Pin card. Opens when a pin is tapped (solo teardrop, compass
            mark, in-view row, or people-strip tile). Bottom-left over
            the map — matches the Kommunity orb tap card. Sits above the
            attribution control (see .maplibregl-ctrl-bottom-left offset
            in _map.scss). */}
        {selectedPin && (
          <PinCard
            pin={selectedPin}
            onClose={closeCard}
            onNoteSaved={handleNoteSaved}
          />
        )}

        {/* Kalendar ↔ Map bridge — event pins on top of the presence
            layer. Self-contained: fetches its own data, owns its own
            markers, and reads `?event=<slug>` from the URL to focus
            on a specific event when someone follows the location link
            from event_detail. */}
        <EventLayer map={mapRef.current} ready={ready} />
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

// ── Off-map compass mark ────────────────────────────────────────────
// One dot pinned to the canvas edge for each direction that has mates
// beyond the viewport. Avatar disc for the first mate in the group; a
// "+N" pill if the group has more; a chevron rotated to point outward.
// Click → onSelect(pin) which flies the map to that mate.

interface CompassMarkData {
  id: string;
  x: number;
  y: number;
  angle: number; // radians, atan2(dy, dx) — 0 is east, π/2 is south (screen coords)
  pins: ApiPresencePinJSON[];
}

const CompassMark: React.FC<{
  mark: CompassMarkData;
  onSelect: (pin: ApiPresencePinJSON) => void;
}> = ({ mark, onSelect }) => {
  const [first] = mark.pins;
  const extra = mark.pins.length - 1;
  const handleClick = useCallback(() => {
    if (first) onSelect(first);
  }, [first, onSelect]);
  if (!first) return null;
  const title = mark.pins.map((p) => p.name).join(', ');
  return (
    <button
      type='button'
      className='map-compass__mark'
      style={{ left: `${mark.x}px`, top: `${mark.y}px` }}
      onClick={handleClick}
      title={title}
      aria-label={title}
    >
      <span
        className='map-compass__avatar'
        style={{ backgroundImage: `url("${first.avatar}")` }}
      />
      {extra > 0 && <span className='map-compass__count'>+{extra}</span>}
      {/* Chevron: an outward-pointing tri built with CSS borders (no
          SVG needed). The parent rotation orients it toward the pin's
          direction; the tri itself is centred at 0,0 relative to the
          rotation origin sitting at the avatar's outer edge. */}
      <span
        className='map-compass__arrow'
        style={{ transform: `rotate(${mark.angle}rad)` }}
      />
    </button>
  );
};
