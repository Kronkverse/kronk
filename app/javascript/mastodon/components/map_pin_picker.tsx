import { useCallback, useEffect, useRef } from 'react';
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
// Kronk basemap with a fixed centre crosshair. The user pans / zooms
// until the crosshair sits over their intended spot, then hits "Pin
// here" to hand `{lng, lat, zoom}` back to the caller. Same modal
// grammar as `<ComposeShell>` / `<ConfirmDialog>` — portal, dim
// backdrop, Escape + backdrop-click cancel — so opening the picker
// from inside another shell reads as a related modal, not a new
// context.
//
// Motivation (Tal 2026-08-14): "the location selector should connect
// to the Map and search actual places… perhaps it should have an
// address bar, to type the address, then an additional option to
// connect to map, with a more general selection." The address bar is
// the primary field (typed, always visible). This picker is the
// secondary opt-in — "I know where it is on the map, let me drop a
// pin" — rather than trying to geocode an address string (which
// would require a hosted geocoder + leaky requests, and is a poor
// fit for the "somewhere loose" nature of most Kronk gatherings).

const messages = defineMessages({
  title: {
    id: 'map_pin_picker.title',
    defaultMessage: 'Pin the location',
  },
  hint: {
    id: 'map_pin_picker.hint',
    defaultMessage:
      'Pan and zoom until the crosshair sits over the spot. Then tap Pin.',
  },
  cancel: { id: 'map_pin_picker.cancel', defaultMessage: 'Cancel' },
  confirm: { id: 'map_pin_picker.confirm', defaultMessage: 'Pin here' },
});

export interface PinnedLocation {
  lng: number;
  lat: number;
  zoom: number;
}

interface Props {
  // Optional initial centre. Falls back to Kronk's HOME_CENTER (Australia).
  initial?: PinnedLocation;
  onCancel: () => void;
  onPin: (location: PinnedLocation) => void;
}

export const MapPinPicker: React.FC<Props> = ({ initial, onCancel, onPin }) => {
  const intl = useIntl();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

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

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [initial]);

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
