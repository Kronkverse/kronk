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
//
// With `children`, the picker is live (Konnect → Map, components/
// konnect_map.tsx): every search result picked, tap, drag or "Centre on
// me" is reported through `onPin` at once, and the children (the Place's
// name and address) take the footer's place, so there is no "Pin here".
// `searchPlaces` lists existing Places above the search results, before
// typing too; picking one calls `onPickPlace`.

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
  places: { id: 'map_pin_picker.places', defaultMessage: 'Places' },
});

// An existing Place offered above the search results.
export interface PlacePick {
  id: string;
  title: string;
  subtitle?: string | null;
}

export interface PinnedLocation {
  lng: number;
  lat: number;
  zoom: number;
  // The search result the pin was dropped on, if it was and the map
  // hasn't been moved off it since (the Place composer fills its
  // address from it).
  label?: string;
}

interface Props {
  // Optional initial centre. When absent, the picker will try the
  // browser's Geolocation API on open; if that fails or is denied,
  // it falls back to Kronk's HOME_CENTER (Australia).
  initial?: PinnedLocation;
  onCancel: () => void;
  onPin: (location: PinnedLocation) => void;
  searchPlaces?: (query: string) => Promise<PlacePick[]>;
  onPickPlace?: (place: PlacePick) => void;
  children?: React.ReactNode;
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

export const MapPinPicker: React.FC<Props> = ({
  initial,
  onCancel,
  onPin,
  searchPlaces,
  onPickPlace,
  children,
}) => {
  const intl = useIntl();
  const live = children !== undefined;
  // Read from the map's listeners, which are bound once.
  const reportRef = useRef<(location: PinnedLocation) => void>();
  reportRef.current = live ? onPin : undefined;
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [locating, setLocating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    ApiGeocodeResultJSON[] | null
  >(null);
  const [searching, setSearching] = useState(false);
  const [placeResults, setPlaceResults] = useState<PlacePick[]>([]);
  // Open from the start when there are Places to offer before typing.
  const [resultsOpen, setResultsOpen] = useState(Boolean(searchPlaces));
  // The label of the search result the crosshair sits on; cleared when
  // the map is clicked elsewhere.
  const pickedLabelRef = useRef<string | null>(null);

  // `report`: the person asked (the button), not the opening guess.
  const centreOnMe = useCallback((report = false) => {
    const map = mapRef.current;
    // Navigator.geolocation is always defined per the DOM types; the
    // error callback below handles the case where the user denies
    // permission or the request times out.
    if (!map) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        pickedLabelRef.current = null;
        map.easeTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: LOCAL_ZOOM,
          duration: 600,
        });
        setLocating(false);
        if (report)
          reportRef.current?.({
            lng: pos.coords.longitude,
            lat: pos.coords.latitude,
            zoom: LOCAL_ZOOM,
          });
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  }, []);

  const centreOnMeClick = useCallback(() => {
    centreOnMe(true);
  }, [centreOnMe]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

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
    map.on('dragstart', () => {
      pickedLabelRef.current = null;
      setResultsOpen(false);
    });
    map.on('dragend', () => {
      const centre = map.getCenter();
      reportRef.current?.({
        lng: centre.lng,
        lat: centre.lat,
        zoom: map.getZoom(),
      });
    });
    map.on('click', (e) => {
      pickedLabelRef.current = null;
      setResultsOpen(false);
      map.easeTo({ center: e.lngLat, duration: 300 });
      reportRef.current?.({
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
        zoom: map.getZoom(),
      });
    });

    mapRef.current = map;

    if (!initial) {
      void map.once('load', () => {
        centreOnMe();
      });
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

  // Existing Places matching the search (all of them before typing).
  useEffect(() => {
    if (!searchPlaces) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      searchPlaces(searchQuery.trim())
        .then((rows) => {
          if (!cancelled) setPlaceResults(rows);
        })
        .catch(() => {
          if (!cancelled) setPlaceResults([]);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchPlaces, searchQuery]);

  const handlePlaceClick = useCallback<
    React.MouseEventHandler<HTMLButtonElement>
  >(
    (e) => {
      const place = placeResults[Number(e.currentTarget.dataset.idx)];
      if (place) onPickPlace?.(place);
    },
    [placeResults, onPickPlace],
  );

  const onSearchChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setSearchQuery(e.target.value);
    setResultsOpen(true);
  }, []);

  const onSearchFocus = useCallback(() => {
    if ((searchResults && searchResults.length > 0) || placeResults.length > 0)
      setResultsOpen(true);
  }, [searchResults, placeResults]);

  const pickResult = useCallback((r: ApiGeocodeResultJSON) => {
    const map = mapRef.current;
    if (!map) return;
    if (!Number.isFinite(r.lat) || !Number.isFinite(r.lng)) return;
    map.easeTo({ center: [r.lng, r.lat], zoom: LOCAL_ZOOM, duration: 600 });
    pickedLabelRef.current = r.label;
    setResultsOpen(false);
    reportRef.current?.({
      lng: r.lng,
      lat: r.lat,
      zoom: LOCAL_ZOOM,
      label: r.label,
    });
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
      }
    },
    [searchResults, pickResult],
  );

  const handlePin = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const centre = map.getCenter();
    onPin({
      lng: centre.lng,
      lat: centre.lat,
      zoom: map.getZoom(),
      ...(pickedLabelRef.current ? { label: pickedLabelRef.current } : {}),
    });
  }, [onPin]);

  const dropdown = useMemo(() => {
    if (!resultsOpen) return null;
    let found: React.ReactNode = null;
    if (searching) {
      found = (
        <p className='map-pin-picker__results-state'>
          <FormattedMessage {...messages.searching} />
        </p>
      );
    } else if (searchResults?.length === 0) {
      found = (
        <p className='map-pin-picker__results-state'>
          <FormattedMessage {...messages.noResults} />
        </p>
      );
    } else if (searchResults) {
      found = (
        <ul className='map-pin-picker__results-list'>
          {searchResults.map((r, i) => (
            // Result rows have no stable server id — use lat+lng+label
            // as the key, which is stable across renders of the same
            // search response and unique within one result set.
            <li key={`${r.lat},${r.lng},${r.label}`}>
              <button
                type='button'
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
    }
    if (!found && placeResults.length === 0) return null;
    return (
      <div className='map-pin-picker__results'>
        {placeResults.length > 0 && (
          <>
            <p className='map-pin-picker__results-heading'>
              <FormattedMessage {...messages.places} />
            </p>
            <ul className='map-pin-picker__results-list'>
              {placeResults.map((p, i) => (
                <li key={p.id}>
                  <button
                    type='button'
                    className='map-pin-picker__result'
                    data-idx={i}
                    onClick={handlePlaceClick}
                  >
                    {p.title}
                    {p.subtitle && (
                      <span className='map-pin-picker__result-sub'>
                        {p.subtitle}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {found}
      </div>
    );
  }, [
    resultsOpen,
    searching,
    searchResults,
    placeResults,
    handleResultClick,
    handlePlaceClick,
  ]);

  // Escape is the picker's alone: caught on the way down, so a composer
  // underneath doesn't close too. One Escape, one dismissal: the results
  // dropdown first, then the picker.
  const dropdownShown = dropdown !== null;
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (dropdownShown) setResultsOpen(false);
      else onCancel();
    };
    window.addEventListener('keydown', handleKey, true);
    return () => {
      window.removeEventListener('keydown', handleKey, true);
    };
  }, [onCancel, dropdownShown]);

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
              ref={searchRef}
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
            onClick={centreOnMeClick}
            disabled={locating}
          >
            {locating ? (
              <FormattedMessage {...messages.centreOnMeBusy} />
            ) : (
              <FormattedMessage {...messages.centreOnMe} />
            )}
          </button>
          {!live && (
            /* Floating primary confirm chip on the map itself. After
              the user searches / geolocates / clicks-to-pin, their
              attention is on the map — the footer confirm is out of
              visual focus (Tal 2026-08-14: "no way to select it
              once i've centered the cross on the location"). Two
              paths to confirm, same action; keyboard users still
              land on the footer via tab order. */
            <button
              type='button'
              className='map-pin-picker__floating-confirm'
              onClick={handlePin}
            >
              <FormattedMessage {...messages.confirm} />
            </button>
          )}
        </div>
        {live ? (
          <footer className='map-pin-picker__details'>{children}</footer>
        ) : (
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
        )}
      </div>
    </div>,
    document.body,
  );
};
