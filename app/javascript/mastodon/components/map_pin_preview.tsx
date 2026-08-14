import { useEffect, useRef } from 'react';

import * as maplibregl from 'maplibre-gl';

import {
  basemapLayers,
  BASEMAP_URL,
  ensurePmtilesProtocol,
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

interface Props {
  lng: number;
  lat: number;
  // The zoom saved with the pin (see PinnedLocation.zoom). If absent
  // we default to street-level.
  zoom?: number;
  className?: string;
}

const DEFAULT_ZOOM = 14;

export const MapPinPreview: React.FC<Props> = ({
  lng,
  lat,
  zoom,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    ensurePmtilesProtocol();
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const map = new maplibregl.Map({
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
  }, []);

  return (
    <div
      className={`map-pin-preview${className ? ` ${className}` : ''}`}
      role='img'
      aria-label={`Map showing pinned location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`}
    >
      <div className='map-pin-preview__map' ref={containerRef} />
      <span className='map-pin-preview__pin' aria-hidden='true' />
    </div>
  );
};
