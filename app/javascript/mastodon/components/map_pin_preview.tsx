import { useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import * as maplibregl from 'maplibre-gl';
// MapLibre CSS — see `map_pin_picker.tsx` for the full rationale.
// Required so the attribution control (bottom-right compact button)
// renders styled when this preview appears standalone (composer
// mounts the preview without visiting the Map korner first).
import 'maplibre-gl/dist/maplibre-gl.css';

import {
  basemapLayers,
  BASEMAP_URL,
  ensurePmtilesProtocol,
  supportsWebGL,
} from 'mastodon/features/map_v2/basemap';

// MapPinPreview — a non-interactive read-only mini-map showing a
// single pin. Used by the event composer to preview a pinned
// location once the user has placed one via `<MapPinPicker>`
// (2026-08-14 Tal: "the event should preview the location on map").
//
// Deliberately spartan: no zoom / pan controls, no click handlers,
// no double-tap zoom — the preview is purely visual. `interactive:
// false` disables all MapLibre interactivity on the instance so a
// scroll-wheel gesture inside the composer doesn't hijack the map.
//
// The pin itself is a small centred dot overlay (same "aim here"
// visual language as `<MapPinPicker>`'s crosshair) rather than a
// full MapLibre marker; the map is fixed to the pin's coordinates
// so the overlay always sits on the right spot.
//
// Without WebGL (turned off in the browser, or MapLibre failing to start)
// there is no map: the preview becomes a plain box with the place's
// `label`, if the caller has one, and a note that the map can't show
// here. It never throws — it sits in feed cards, and a throw there used
// to reach the app-level error page (docs/spaces/map.md, "Without WebGL").

const messages = defineMessages({
  noMap: {
    id: 'map_pin_preview.no_map',
    defaultMessage: 'No map: this browser has WebGL turned off.',
  },
});

interface Props {
  lng: number;
  lat: number;
  // The zoom saved with the pin (see PinnedLocation.zoom). If absent
  // we default to street-level.
  zoom?: number;
  // The place's name or address, shown when there's no map to draw.
  label?: string | null;
  className?: string;
}

const DEFAULT_ZOOM = 14;

export const MapPinPreview: React.FC<Props> = ({
  lng,
  lat,
  zoom,
  label,
  className,
}) => {
  const intl = useIntl();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [noMap, setNoMap] = useState(() => !supportsWebGL());

  useEffect(() => {
    const container = containerRef.current;
    if (noMap || !container || mapRef.current) return;
    ensurePmtilesProtocol();

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container,
        center: [lng, lat],
        zoom: zoom ?? DEFAULT_ZOOM,
        interactive: false,
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
    } catch {
      setNoMap(true);
      return;
    }

    // Defensive resize once the style loads. If the container was
    // measured at 0×0 during React's first paint (rare but possible
    // inside a freshly-mounted flex column that hasn't finished
    // laying out), MapLibre would initialise a zero-viewport map
    // and never fetch tiles even after the container grew. A resize
    // triggered on `load` recomputes the viewport off the container's
    // actual dimensions at paint time — cheap, idempotent when the
    // size was already correct (Tal 2026-08-14: preview rendered
    // container + pin dot but no tiles).
    // `map.once` returns a Promise in newer MapLibre types when no
    // callback is passed; with a callback it registers a one-time
    // listener. `void` keeps the floating-promise rule quiet without
    // changing behaviour — same pattern the pin picker uses.
    void map.once('load', () => {
      map.resize();
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Deliberately not re-running when lng/lat/zoom change — this
    // preview is meant to reflect the pin at mount. If the caller
    // wants a new preview for a new pin they unmount + remount by
    // giving the component a fresh `key`. The alternative (using
    // `map.easeTo` on prop change) adds render cost + a subtle
    // animation the caller often doesn't want.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noMap]);

  const classes = `map-pin-preview${className ? ` ${className}` : ''}`;

  if (noMap) {
    return (
      <div className={`${classes} map-pin-preview--no-map`}>
        {label && <p className='map-pin-preview__label'>{label}</p>}
        <p className='map-pin-preview__note'>
          {intl.formatMessage(messages.noMap)}
        </p>
      </div>
    );
  }

  return (
    <div
      className={classes}
      role='img'
      aria-label={`Map showing pinned location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`}
    >
      <div className='map-pin-preview__map' ref={containerRef} />
      <span className='map-pin-preview__pin' aria-hidden='true' />
    </div>
  );
};
