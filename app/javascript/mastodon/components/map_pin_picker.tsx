import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import * as maplibregl from 'maplibre-gl';
// MapLibre's own CSS ships the zoom/attribution/geolocate control
// styles. Without it, `map.addControl(new NavigationControl(...))`
// renders as unstyled DOM (Tal 2026-08-14: zoom buttons "half
// hidden in some strange section under the map" — that section was
// the naked <button> stack with no MapLibre CSS to style + position
// them). Imported here so the picker works on its own regardless of
// whether the Map korner has been visited first.
import 'maplibre-gl/dist/maplibre-gl.css';

import { apiGeocodeSearch } from 'mastodon/api/map';
import type { ApiGeocodeResultJSON } from 'mastodon/api/map';
import {
  basemapLayers,
  BASEMAP_URL,
  ensurePmtilesProtocol,
  HOME_CENTER,
  HOME_ZOOM,
} from 'mastodon/features/map_v2/basemap';

// MapPinPicker — a portal-mounted picker overlay that shows the shared
// Kronk basemap with a movable centre crosshair. Three ways to place
// the pin:
//   1. Type in the search box (uses Kronk's server-side Nominatim
//      proxy at `/api/v1/map/geocode` — same endpoint the Map
//      korner's `<PlaceControl>` uses, so results match what a user
//      sees when they search from the Map itself and the server can
//      set a proper User-Agent + cache repeat queries).
//   2. "Centre on me" — browser geolocation eases the map to the
//      user's current position at street-level zoom.
//   3. Click / tap anywhere on the map — the crosshair moves there
//      (zoom preserved).
//
// Same modal grammar as `<ComposeShell>` / `<ConfirmDialog>` —
// portal, dim backdrop, Escape + backdrop-click cancel — so opening
// the picker from inside another shell reads as a related modal.
//
// Known limitation (2026-08-14): the Kronk basemap deliberately
// drops symbol (label) layers — no place / road / suburb names —
// because rendering them needs externally-hosted glyphs. The search
// box + geolocation + click-to-pin cover the "how do I find
// somewhere?" gap that would otherwise create.

const messages = defineMessages({
  title: {
    id: 'map_pin_picker.title',
    defaultMessage: 'Pin the location',
  },
  hint: {
    id: 'map_pin_picker.hint',
    defaultMessage:
      'Search a place, use your current location, or tap the map.',
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
  searchPlaceholder: {
    id: 'map_pin_picker.search_placeholder',
    defaultMessage: 'Search a place, address, or landmark',
  },
  searching: {
    id: 'map_pin_picker.searching',
    defaultMessage: 'Searching…',
  },
  noResults: {
    id: 'map_pin_picker.no_results',
    defaultMessage: 'No matches. Try a different search.',
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

// Nominatim's own recommendation: no more than 1 request per second
// per client (enforced upstream + cached in Kronk's proxy). Debouncing
// at 400ms typing pause + only firing on meaningful input keeps us
// well under, and the server-side cache absorbs repeat queries.
const SEARCH_DEBOUNCE_MS = 400;
const SEARCH_MIN_LENGTH = 3;

export const MapPinPicker: React.FC<Props> = ({ initial, onCancel, onPin }) => {
  const intl = useIntl();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [locating, setLocating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    ApiGeocodeResultJSON[] | null
  >(null);
  const [searching, setSearching] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);

  const centreOnMe = useCallback(() => {
    const map = mapRef.current;
    // Navigator.geolocation is always defined per the DOM types; the
    // error callback below handles the case where the user denies
    // permission or the request times out.
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

    if (!initial) {
      void map.once('load', centreOnMe);
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [initial, centreOnMe]);

  // Debounced geocoder query via Kronk's server-side proxy at
  // `/api/v1/map/geocode` (see `mastodon/api/map.ts`). Same endpoint
  // the Map korner's `<PlaceControl>` uses — same results, same
  // caching, and Kronk's server sets the identifying User-Agent that
  // Nominatim's usage policy expects (browsers can't set that
  // header, which is why the initial direct-Nominatim implementation
  // returned no matches — Nominatim silently blocks unidentified
  // browser UAs). Aborts in-flight requests when the query changes
  // so late responses don't clobber the latest results.
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < SEARCH_MIN_LENGTH) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      apiGeocodeSearch(trimmed)
        .then((data) => {
          if (cancelled) return;
          setSearchResults(data);
          setSearching(false);
          setResultsOpen(true);
        })
        .catch(() => {
          if (cancelled) return;
          setSearchResults([]);
          setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  const onSearchChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setSearchQuery(e.target.value);
    setResultsOpen(true);
  }, []);

  const onSearchFocus = useCallback(() => {
    if (searchResults && searchResults.length > 0) setResultsOpen(true);
  }, [searchResults]);

  const pickResult = useCallback((r: ApiGeocodeResultJSON) => {
    const map = mapRef.current;
    if (!map) return;
    if (!Number.isFinite(r.lat) || !Number.isFinite(r.lng)) return;
    map.easeTo({ center: [r.lng, r.lat], zoom: LOCAL_ZOOM, duration: 600 });
    setResultsOpen(false);
  }, []);

  const handleResultClick = useCallback<
    React.MouseEventHandler<HTMLButtonElement>
  >(
    (e) => {
      const idx = Number(e.currentTarget.dataset.idx);
      if (!Number.isFinite(idx)) return;
      const r = searchResults?.[idx];
      if (r) pickResult(r);
    },
    [searchResults, pickResult],
  );

  const handleSearchKey = useCallback<
    React.KeyboardEventHandler<HTMLInputElement>
  >(
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const first = searchResults?.[0];
        if (first) pickResult(first);
      } else if (e.key === 'Escape') {
        // Let Escape close the results dropdown before it closes the
        // picker — matches the standard "one Escape = one dismissal"
        // pattern users expect from search dropdowns.
        if (resultsOpen) {
          e.stopPropagation();
          setResultsOpen(false);
        }
      }
    },
    [searchResults, resultsOpen, pickResult],
  );

  const handlePin = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const centre = map.getCenter();
    onPin({ lng: centre.lng, lat: centre.lat, zoom: map.getZoom() });
  }, [onPin]);

  const dropdown = useMemo(() => {
    if (!resultsOpen) return null;
    if (searching) {
      return (
        <div
          className='map-pin-picker__results map-pin-picker__results--state'
          role='listbox'
        >
          <FormattedMessage {...messages.searching} />
        </div>
      );
    }
    if (searchResults === null) return null;
    if (searchResults.length === 0) {
      return (
        <div
          className='map-pin-picker__results map-pin-picker__results--state'
          role='listbox'
        >
          <FormattedMessage {...messages.noResults} />
        </div>
      );
    }
    return (
      <ul className='map-pin-picker__results' role='listbox'>
        {searchResults.map((r, i) => (
          // Result rows have no stable server id — use lat+lng+label
          // as the key, which is stable across renders of the same
          // search response and unique within one result set.
          <li key={`${r.lat},${r.lng},${r.label}`} role='none'>
            <button
              type='button'
              role='option'
              aria-selected='false'
              className='map-pin-picker__result'
              data-idx={i}
              onClick={handleResultClick}
            >
              {r.label}
            </button>
          </li>
        ))}
      </ul>
    );
  }, [resultsOpen, searching, searchResults, handleResultClick]);

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
          <div className='map-pin-picker__search'>
            <input
              type='search'
              className='map-pin-picker__search-input'
              value={searchQuery}
              onChange={onSearchChange}
              onFocus={onSearchFocus}
              onKeyDown={handleSearchKey}
              placeholder={intl.formatMessage(messages.searchPlaceholder)}
              aria-label={intl.formatMessage(messages.searchPlaceholder)}
              autoComplete='off'
            />
            {dropdown}
          </div>
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
          {/* Floating primary confirm chip on the map itself. After
              the user searches / geolocates / clicks-to-pin, their
              attention is on the map — the footer confirm is out of
              visual focus (Tal 2026-08-14: "no way to select it
              once i've centered the cross on the location"). Two
              paths to confirm, same action; keyboard users still
              land on the footer via tab order. */}
          <button
            type='button'
            className='map-pin-picker__floating-confirm'
            onClick={handlePin}
          >
            <FormattedMessage {...messages.confirm} />
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
