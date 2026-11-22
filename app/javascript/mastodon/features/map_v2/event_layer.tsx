import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  defineMessages,
  FormattedDate,
  FormattedTime,
  useIntl,
} from 'react-intl';
import type { IntlShape } from 'react-intl';

import { Link, useLocation } from 'react-router-dom';

import * as maplibregl from 'maplibre-gl';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import VideocamIcon from '@/material-icons/400-24px/diversity_2.svg?react';
import LocationIcon from '@/material-icons/400-24px/location_on.svg?react';
import SpiralIcon from '@/material-icons/400-24px/spiral.svg?react';
import { apiGetMapEvents } from 'mastodon/api/map';
import type {
  ApiMapCountryJSON,
  ApiMapEventPinJSON,
  ApiMapEventPlaceJSON,
} from 'mastodon/api/map';
import { Icon } from 'mastodon/components/icon';

import { CountryLine } from './country_line';

// Event layer — draws Kalendar event pins on top of the Mates map: your
// events only (hosting, going, interested), plus a deep-linked one.
// Kept as its own module (not mixed into mates_view's clustering /
// anonymisation model) because events don't share those constraints:
// event locations are already visibility-gated at the Event level,
// aren't per-account presence, and don't participate in the "N here"
// people cluster.
//
// The layer also owns the `?event=<slug>` deep link — event_detail's
// location row now points at `/hub/map?event=<slug>`, and this module
// flies the map to that pin + opens its preview card on arrival.

// One marker per spot (docs/spaces/map.md, Events). An event whose
// location is a Konnected Place stands on that Place, and the Places layer
// draws Places too, so the two used to stack: a Place pin over an event
// tile. Now the events at a spot are one marker, a date badge, and the
// Place they stand on leaves its own pin off (`onPlaces`, which mates_view
// hands to PlaceLayer). Tapping it opens one card: the events, then the
// Place.

const messages = defineMessages({
  close: { id: 'map.event_card.close', defaultMessage: 'Close' },
  open: { id: 'map.event_card.open', defaultMessage: 'Open in Kalendar →' },
  openPlace: {
    id: 'map.event_card.open_place',
    defaultMessage: 'Open place →',
  },
  spot: {
    id: 'map.event_pin.label',
    defaultMessage: '{count, plural, one {{title}} other {# events here}}',
  },
});

// What's on (docs/spaces/map.md, Events): an Event happening now glows and
// pulses, and one in the next week glows softly, so you can see at a glance
// where things are on. An Event with no end counts as on for three hours.
const SOON_MS = 7 * 24 * 60 * 60 * 1000;
const OPEN_ENDED_MS = 3 * 60 * 60 * 1000;

const whatsOn = (
  pin: ApiMapEventPinJSON,
  now = Date.now(),
): 'now' | 'soon' | null => {
  const start = Date.parse(pin.start_time);
  const end = pin.end_time ? Date.parse(pin.end_time) : start + OPEN_ENDED_MS;
  if (start <= now && now < end) return 'now';
  if (start > now && start - now <= SOON_MS) return 'soon';
  return null;
};

// The events at one spot: the ones on one Place, or at one point. Soonest
// first, so the marker shows the next one.
interface Spot {
  key: string;
  lat: number;
  lng: number;
  zoom: number | null;
  place: ApiMapEventPlaceJSON | null;
  events: ApiMapEventPinJSON[];
}

const spotKey = (pin: ApiMapEventPinJSON) =>
  pin.place
    ? `place:${pin.place.id}`
    : `at:${pin.lat.toFixed(5)},${pin.lng.toFixed(5)}`;

const toSpots = (events: ApiMapEventPinJSON[]): Spot[] => {
  const spots = new Map<string, Spot>();
  [...events]
    .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time))
    .forEach((pin) => {
      const key = spotKey(pin);
      const spot = spots.get(key);
      if (spot) spot.events.push(pin);
      else
        spots.set(key, {
          key,
          lat: pin.lat,
          lng: pin.lng,
          zoom: pin.zoom,
          place: pin.place ?? null,
          events: [pin],
        });
    });
  return [...spots.values()];
};

// The busiest "what's on" among a spot's events.
const spotOn = (spot: Spot) => {
  const on = spot.events.map((pin) => whatsOn(pin));
  if (on.includes('now')) return 'now';
  if (on.includes('soon')) return 'soon';
  return null;
};

// Marker DOM (MapLibre owns positioning): a small date badge, the month
// over the day, like the card's and Kalendar's, with a point at the spot.
// "+2" when more events share the spot. Built with textContent, so a
// title can't become markup.
const buildSpotMarker = (spot: Spot, intl: IntlShape): HTMLElement => {
  const next = spot.events[0];
  if (!next) throw new Error('A spot has an event');
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'map-event-pin';
  const label = intl.formatMessage(messages.spot, {
    count: spot.events.length,
    title: next.title,
  });
  el.title = label;
  el.setAttribute('aria-label', label);
  if (spot.events.every((pin) => pin.event_type === 'huddle'))
    el.classList.add('map-event-pin--huddle');
  const on = spotOn(spot);
  if (on) el.classList.add(`map-event-pin--${on}`);

  const month = document.createElement('span');
  month.className = 'map-event-pin__month';
  month.textContent = intl.formatDate(next.start_time, { month: 'short' });
  const day = document.createElement('span');
  day.className = 'map-event-pin__day';
  day.textContent = intl.formatDate(next.start_time, { day: 'numeric' });
  el.append(month, day);

  if (spot.events.length > 1) {
    const more = document.createElement('span');
    more.className = 'map-event-pin__more';
    more.textContent = `+${spot.events.length - 1}`;
    el.appendChild(more);
  }
  return el;
};

interface Props {
  map: maplibregl.Map | null;
  ready: boolean;
  // The Places events stand on, whose own pins the Places layer leaves off.
  onPlaces?: (ids: ReadonlySet<string>) => void;
}

export const EventLayer: React.FC<Props> = ({ map, ready, onPlaces }) => {
  const intl = useIntl();
  const [events, setEvents] = useState<ApiMapEventPinJSON[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const spots = useMemo(() => toSpots(events), [events]);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const location = useLocation();

  // Read `?event=<slug>` — the deep link that focuses the map on a
  // specific event's pin. Recomputed on URL change so a navigation
  // within the SPA (e.g. back → different event) re-triggers the fly.
  const requestedSlug = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('event');
  }, [location.search]);

  // ── Fetch events ─────────────────────────────────────────────────
  // Your events, plus the deep-linked one so its pin shows even when you
  // haven't answered it. Refetched when the deep link changes.
  useEffect(() => {
    void apiGetMapEvents(requestedSlug)
      .then(setEvents)
      .catch(() => undefined);
  }, [requestedSlug]);

  useEffect(() => {
    onPlaces?.(
      new Set(spots.flatMap((spot) => (spot.place ? [spot.place.id] : []))),
    );
  }, [spots, onPlaces]);

  // ── Render markers ───────────────────────────────────────────────
  useEffect(() => {
    if (!map || !ready) return;

    // Tear down previous markers before re-render so a fetch refresh
    // doesn't accumulate ghosts.
    markersRef.current.forEach((m) => {
      m.remove();
    });
    markersRef.current = [];

    markersRef.current = spots.map((spot) => {
      const el = buildSpotMarker(spot, intl);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedKey(spot.key);
        map.flyTo({
          center: [spot.lng, spot.lat],
          zoom: Math.min(Math.max(map.getZoom(), 12), 15),
          duration: 700,
        });
      });
      return new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([spot.lng, spot.lat])
        .addTo(map);
    });

    return () => {
      markersRef.current.forEach((m) => {
        m.remove();
      });
      markersRef.current = [];
    };
  }, [spots, map, ready, intl]);

  // ── Handle ?event=<slug> deep link ───────────────────────────────
  useEffect(() => {
    if (!map || !ready || !requestedSlug) return;
    const target = spots.find((spot) =>
      spot.events.some((e) => e.slug === requestedSlug),
    );
    if (!target) return;
    setSelectedKey(target.key);
    map.flyTo({
      center: [target.lng, target.lat],
      zoom: target.zoom ?? 14,
      duration: 900,
    });
  }, [requestedSlug, spots, map, ready]);

  const selected = useMemo(
    () => spots.find((spot) => spot.key === selectedKey) ?? null,
    [spots, selectedKey],
  );

  const handleClose = useCallback(() => {
    setSelectedKey(null);
  }, []);

  if (!selected) return null;

  return <SpotCard spot={selected} onClose={handleClose} />;
};

// One event in the card: its date, what and when, and the way to it.
const SpotEvent: React.FC<{ event: ApiMapEventPinJSON }> = ({ event }) => {
  const intl = useIntl();
  return (
    <div className='map-event-card__event'>
      <div className='map-event-card__date'>
        <span className='map-event-card__date-month'>
          <FormattedDate value={event.start_time} month='short' />
        </span>
        <span className='map-event-card__date-day'>
          <FormattedDate value={event.start_time} day='numeric' />
        </span>
      </div>
      <div className='map-event-card__body'>
        <div className='map-event-card__title'>
          {event.event_type === 'huddle' ? (
            <Icon
              id='videocam'
              icon={VideocamIcon}
              className='map-event-card__type-icon'
            />
          ) : (
            <Icon
              id='spiral'
              icon={SpiralIcon}
              className='map-event-card__type-icon'
            />
          )}
          {event.title}
        </div>
        <div className='map-event-card__meta'>
          <FormattedDate value={event.start_time} weekday='short' />{' '}
          <FormattedTime value={event.start_time} />
          {event.end_time && (
            <>
              {' – '}
              <FormattedTime value={event.end_time} />
            </>
          )}
        </div>
        <Link
          to={`/hub/kalendar/${event.slug}`}
          className='map-event-card__open'
        >
          {intl.formatMessage(messages.open)}
        </Link>
      </div>
    </div>
  );
};

// The card for a spot: each event there, then where they are, the Place
// with its way in when they stand on one, or the event's own place name.
const SpotCard: React.FC<{
  spot: Spot;
  onClose: () => void;
}> = ({ spot, onClose }) => {
  const intl = useIntl();
  const first = spot.events[0];
  const country: ApiMapCountryJSON | null | undefined = first?.country;
  const name = spot.place?.name ?? first?.location_name;
  const label = spot.place?.name ?? first?.title ?? '';

  return (
    <div
      className='map-event-card map-event-card--spot'
      role='dialog'
      aria-label={label}
    >
      <button
        type='button'
        className='map-event-card__close'
        onClick={onClose}
        aria-label={intl.formatMessage(messages.close)}
      >
        <Icon id='close' icon={CloseIcon} />
      </button>
      <div className='map-event-card__events'>
        {spot.events.map((event) => (
          <SpotEvent key={event.id} event={event} />
        ))}
      </div>
      {(name ?? country?.name) && (
        <div className='map-event-card__where'>
          {name && (
            <div className='map-event-card__location'>
              <Icon
                id='location_on'
                icon={LocationIcon}
                className='map-event-card__type-icon'
              />
              {name}
            </div>
          )}
          {spot.place?.address && (
            <div className='map-place-card__address'>{spot.place.address}</div>
          )}
          <CountryLine country={country} />
          {spot.place && (
            <Link to={spot.place.url} className='map-event-card__open'>
              {intl.formatMessage(messages.openPlace)}
            </Link>
          )}
        </div>
      )}
    </div>
  );
};
