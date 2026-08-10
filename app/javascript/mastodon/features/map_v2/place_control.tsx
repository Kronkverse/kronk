import { useState, useEffect, useRef, useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import axios from 'axios';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import PushPinIcon from '@/material-icons/400-24px/push_pin.svg?react';
import SearchIcon from '@/material-icons/400-24px/search.svg?react';
import { apiGeocodeSearch, apiPlacePresence } from 'mastodon/api/map';
import type {
  ApiGeocodeResultJSON,
  ApiPresencePinJSON,
} from 'mastodon/api/map';
import { Icon } from 'mastodon/components/icon';

// Map — "search a place" control. A small pin icon at the map's
// bottom-left; tap it and a search box slides open. Typing debounces
// against `Api::V1::Map::GeocodeController` (an OSM Nominatim proxy)
// and any result is one tap away from becoming your pin.
//
// Prior UI asked the browser for GPS then let you pick between two
// precisions ("Neighbourhood" / "City"). That coupled *where* you're
// placed to *how the device sees you*, which is the wrong axis on a
// social map — people want to say "I'm in Wellington" without leaking
// their exact device coordinate, and want to drop themselves anywhere,
// not only where they physically are. Search-by-place solves both:
// the coordinate is a public place's centre, and any place on earth
// is reachable.
//
// Pin precision is always 'city' here — the input is a place name, and
// the server-side geo_coarsen jitters within a ~6km radius so we don't
// pin the exact centre of a place.

const messages = defineMessages({
  open: { id: 'map.place_control.open', defaultMessage: 'Place me on the map' },
  close: { id: 'map.place_control.close', defaultMessage: 'Close' },
  placeholder: {
    id: 'map.place_control.placeholder',
    defaultMessage: 'Search any place on earth',
  },
  attribution: {
    id: 'map.place_control.attribution',
    defaultMessage: 'Search by OpenStreetMap · Nominatim',
  },
  searching: {
    id: 'map.place_control.searching',
    defaultMessage: 'Searching…',
  },
  empty: {
    id: 'map.place_control.empty',
    defaultMessage: 'No matches — try a different name.',
  },
  error: {
    id: 'map.place_control.error',
    defaultMessage: "Couldn't reach the geocoder — try again.",
  },
  placeError: {
    id: 'map.place_control.place_error',
    defaultMessage: "Couldn't drop your pin — try again.",
  },
  placing: {
    id: 'map.place_control.placing',
    defaultMessage: 'Dropping your pin…',
  },
});

// Nominatim's usage policy is one request per second; we debounce
// keystrokes at 350ms which comfortably clears that while feeling live.
const DEBOUNCE_MS = 350;

interface Props {
  onPlaced: (pin: ApiPresencePinJSON) => void;
}

// Result row is its own component so its click handler can bind
// `result` via useCallback without an inline arrow in JSX
// (react/jsx-no-bind).
const ResultRow: React.FC<{
  result: ApiGeocodeResultJSON;
  disabled: boolean;
  onSelect: (result: ApiGeocodeResultJSON) => void;
}> = ({ result, disabled, onSelect }) => {
  const handleClick = useCallback(() => {
    onSelect(result);
  }, [onSelect, result]);

  return (
    <li>
      <button
        type='button'
        className='place-control__result'
        onClick={handleClick}
        disabled={disabled}
      >
        {result.label}
      </button>
    </li>
  );
};

export const PlaceControl: React.FC<Props> = ({ onPlaced }) => {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ApiGeocodeResultJSON[]>([]);
  const [status, setStatus] = useState<
    'idle' | 'searching' | 'empty' | 'error'
  >('idle');
  const [placing, setPlacing] = useState(false);
  // Separate from `status` — place failures were reusing the search
  // error copy ("Couldn't reach the geocoder"), which read as "search
  // is broken" when what actually broke was `POST /api/v1/map/presence`
  // after the user picked a result. Keep the two concerns distinct so
  // the copy points at the thing that failed.
  const [placeError, setPlaceError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Monotonic id of the latest issued search. Every fetch captures its
  // own id; when it settles, it ignores itself if a newer search has
  // been issued in the meantime. Without this, a stale rejected
  // request can arrive after a newer successful one and flip the panel
  // to the "couldn't reach the geocoder" error while the newer
  // results are still on screen.
  const searchIdRef = useRef(0);

  // Autofocus when the panel opens so the caller doesn't need a second tap.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Debounced geocode. A new keystroke cancels the pending timer, so
  // only the last one after a 350ms pause hits the server. In-flight
  // fetches from prior keystrokes can still land after a newer one;
  // the searchIdRef guard below drops their results.
  useEffect(() => {
    if (!open) return;

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      searchIdRef.current += 1; // invalidate any in-flight fetch
      setResults([]);
      setStatus('idle');
      return;
    }

    setStatus('searching');
    const handle = window.setTimeout(() => {
      searchIdRef.current += 1;
      const mySearchId = searchIdRef.current;
      apiGeocodeSearch(trimmed)
        .then((rows) => {
          if (mySearchId !== searchIdRef.current) return;
          setResults(rows);
          setStatus(rows.length === 0 ? 'empty' : 'idle');
        })
        .catch(() => {
          if (mySearchId !== searchIdRef.current) return;
          setResults([]);
          setStatus('error');
        });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(handle);
    };
  }, [query, open]);

  const handleOpen = useCallback(() => {
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setQuery('');
    setResults([]);
    setStatus('idle');
    setPlaceError(null);
  }, []);

  const defaultPlaceError = intl.formatMessage(messages.placeError);

  const handleSelect = useCallback(
    (result: ApiGeocodeResultJSON) => {
      setPlacing(true);
      setPlaceError(null);
      apiPlacePresence({
        lat: result.lat,
        lng: result.lng,
        precision: 'city',
        share_scope: 'friends',
        label: result.label,
      })
        .then((pin) => {
          onPlaced(pin);
          handleClose();
        })
        .catch((err: unknown) => {
          // PresenceController#create returns `{ error: "…" }` on
          // ParameterMissing / ArgumentError / RecordInvalid / any
          // unhandled exception (see PR #1273). Surface that verbatim
          // when present so a specific validation message or the
          // "Could not drop your pin. Try again in a moment." fallback
          // reaches the user, instead of always showing the generic
          // client-side copy that swallows the real cause.
          let message = defaultPlaceError;
          if (axios.isAxiosError(err)) {
            const body = err.response?.data as { error?: string } | undefined;
            if (body?.error && typeof body.error === 'string') {
              message = body.error;
            }
          }
          setPlaceError(message);
        })
        .finally(() => {
          setPlacing(false);
        });
    },
    [onPlaced, handleClose, defaultPlaceError],
  );

  const handleQueryChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(event.target.value);
    },
    [],
  );

  if (!open) {
    return (
      <button
        type='button'
        className='place-control__fab'
        onClick={handleOpen}
        aria-label={intl.formatMessage(messages.open)}
        title={intl.formatMessage(messages.open)}
      >
        <Icon id='pin' icon={PushPinIcon} />
      </button>
    );
  }

  return (
    <div
      className='place-control'
      role='dialog'
      aria-label={intl.formatMessage(messages.open)}
    >
      <div className='place-control__search'>
        <Icon
          id='search'
          icon={SearchIcon}
          className='place-control__search-icon'
        />
        <input
          ref={inputRef}
          type='search'
          className='place-control__input'
          value={query}
          onChange={handleQueryChange}
          placeholder={intl.formatMessage(messages.placeholder)}
          disabled={placing}
        />
        <button
          type='button'
          className='place-control__close'
          onClick={handleClose}
          aria-label={intl.formatMessage(messages.close)}
        >
          <Icon id='close' icon={CloseIcon} />
        </button>
      </div>

      {status === 'searching' && (
        <div className='place-control__meta'>
          {intl.formatMessage(messages.searching)}
        </div>
      )}
      {status === 'empty' && (
        <div className='place-control__meta'>
          {intl.formatMessage(messages.empty)}
        </div>
      )}
      {status === 'error' && (
        <div className='place-control__meta place-control__meta--error'>
          {intl.formatMessage(messages.error)}
        </div>
      )}
      {placeError && !placing && (
        <div className='place-control__meta place-control__meta--error'>
          {placeError}
        </div>
      )}
      {placing && (
        <div className='place-control__meta'>
          {intl.formatMessage(messages.placing)}
        </div>
      )}

      {results.length > 0 && (
        <ul className='place-control__results'>
          {results.map((result) => (
            <ResultRow
              key={`${result.lat},${result.lng},${result.label}`}
              result={result}
              disabled={placing}
              onSelect={handleSelect}
            />
          ))}
        </ul>
      )}

      <div className='place-control__attribution'>
        {intl.formatMessage(messages.attribution)}
      </div>
    </div>
  );
};
