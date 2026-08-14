import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import * as maplibregl from 'maplibre-gl';

import {
  basemapLayers,
  BASEMAP_URL,
  ensurePmtilesProtocol,
  HOME_CENTER,
  HOME_ZOOM,
} from 'mastodon/features/map_v2/basemap';

// MapPinPicker — a portal-mounted picker overlay that shows the shared
// Kronk basemap with a movable centre crosshair. On open the picker
// asks the browser for the user's geolocation and centres/zooms
// there; falling back to the AU-wide HOME_CENTER when permission is
// denied. Clicking anywhere on the map re-centres the crosshair
// there ("click to pin"); the user can still pan/zoom by hand. The
// "Centre on me" button re-runs geolocation on demand. Same modal
// grammar as `<ComposeShell>` / `<ConfirmDialog>` — portal, dim
// backdrop, Escape + backdrop-click cancel — so opening the picker
// from inside another shell reads as a related modal.
//
// Known limitation (2026-08-14): the Kronk basemap deliberately
// drops symbol (label) layers — no place / road / suburb names —
// because rendering them needs externally-hosted glyphs. Fine for
// the Treks lens; a real gap in a pin picker where "am I over
// Melbourne or Sydney?" is the question. Geolocation + click-to-pin
// works around it (if you're at the spot, you don't need labels to
// find it). Labels are a follow-up call about glyph hosting.

const messages = defineMessages({
  title: {
    id: 'map_pin_picker.title',
    defaultMessage: 'Pin the location',
  },
  hint: {
    id: 'map_pin_picker.hint',
    defaultMessage:
      'Click the map where you are, or drag to pan. Then tap Pin.',
  },
  cancel: { id: 'map_pin_picker.cancel', defaultMessage: 'Cancel' },
  confirm: { id: 'map_pin_picker.confirm', defaultMessage: 'Pin here' },
  centreOnMe: {
    id: 'map_pin_picker.centre_on_me',
    defaultMessage: 'Centre on me',
  },
  centreOnMeBusy: {
    id: 'map_pin_picker.centre_on_me_busy',
    defaultMessage: 'Locating…',
  },
});

export interface PinnedLocation {
  lng: number;
  lat: number;
  zoom: number;
}

interface Props {
  // Optional initial centre. When absent, the picker will try the
  // browser's Geolocation API on open; if that fails or is denied,
  // it falls back to Kronk's HOME_CENTER (Australia).
  initial?: PinnedLocation;
  onCancel: () => void;
  onPin: (location: PinnedLocation) => void;
}

// A comfortable "street-level" zoom for pinning a specific spot. Not
// so far in that a small GPS jitter looks huge; not so far out that
// the pin is meaningless.
const LOCAL_ZOOM = 14;

export const MapPinPicker: React.FC<Props> = ({ initial, onCancel, onPin }) => {
  const intl = useIntl();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [locating, setLocating] = useState(false);

  // Ask the browser for the user's position and centre the map on it.
  // Silent on failure — the map already has a fallback centre and the
  // user can pan/click to pin manually. Kept as a stable callback so
  // the "Centre on me" button + the on-open effect share it.
  const centreOnMe = useCallback(() => {
    const map = mapRef.current;
    // Navigator.geolocation is always defined per the DOM types; the
    // error callback below handles the case where the user denies
    // permission or the request times out (or a very old browser
    // doesn't actually implement it).
    if (!map) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.easeTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: LOCAL_ZOOM,
          duration: 600,
        });
        setLocating(false);
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [onCancel]);

  useEffect(() => {
    ensurePmtilesProtocol();
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const map = new maplibregl.Map({
      container,
      center: initial ? [initial.lng, initial.lat] : HOME_CENTER,
      zoom: initial?.zoom ?? HOME_ZOOM,
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

    // Click anywhere on the map → move the crosshair there. The
    // crosshair is a fixed CSS overlay pinned to the map's centre,
    // so "move the crosshair" is really "recentre the map on the
    // click point." easeTo (not flyTo) keeps the zoom the user has
    // already chosen — click-to-pin at street level should not zoom
    // out to the world.
    map.on('click', (e) => {
      map.easeTo({ center: e.lngLat, duration: 300 });
    });

    mapRef.current = map;

    // Only geolocate on the first open when the caller didn't hand us
    // an `initial` pin (an already-pinned location wins over "where am
    // I now"). Wait for the style to be ready so the eased camera
    // animates against real tiles.
    if (!initial) {
      // `map.once` returns a Promise in the newer MapLibre types when
      // no callback is passed, but with a callback it registers a
      // one-time listener; explicit `void` keeps the floating-promise
      // rule quiet without changing behaviour.
      void map.once('load', centreOnMe);
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [initial, centreOnMe]);

  const handlePin = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const centre = map.getCenter();
    onPin({ lng: centre.lng, lat: centre.lat, zoom: map.getZoom() });
  }, [onPin]);

  return createPortal(
    <div
      className='map-pin-picker'
      role='dialog'
      aria-modal='true'
      aria-labelledby='map-pin-picker__title'
    >
      <button
        type='button'
        className='map-pin-picker__backdrop'
        onClick={onCancel}
        aria-label={intl.formatMessage(messages.cancel)}
      />
      <div className='map-pin-picker__panel'>
        <header className='map-pin-picker__header'>
          <h2 id='map-pin-picker__title' className='map-pin-picker__title'>
            <FormattedMessage {...messages.title} />
          </h2>
          <p className='map-pin-picker__hint'>
            <FormattedMessage {...messages.hint} />
          </p>
        </header>
        <div className='map-pin-picker__map' ref={containerRef}>
          <span className='map-pin-picker__crosshair' aria-hidden='true' />
          <button
            type='button'
            className='map-pin-picker__locate'
            onClick={centreOnMe}
            disabled={locating}
          >
            {locating ? (
              <FormattedMessage {...messages.centreOnMeBusy} />
            ) : (
              <FormattedMessage {...messages.centreOnMe} />
            )}
          </button>
        </div>
        <footer className='map-pin-picker__footer'>
          <button
            type='button'
            className='map-pin-picker__cancel'
            onClick={onCancel}
          >
            <FormattedMessage {...messages.cancel} />
          </button>
          <button
            type='button'
            className='map-pin-picker__confirm'
            onClick={handlePin}
          >
            <FormattedMessage {...messages.confirm} />
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
};
