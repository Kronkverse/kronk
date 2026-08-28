import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { FormattedDate, FormattedTime } from 'react-intl';

import { Link, useLocation } from 'react-router-dom';

import * as maplibregl from 'maplibre-gl';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import VideocamIcon from '@/material-icons/400-24px/diversity_2.svg?react';
import SpiralIcon from '@/material-icons/400-24px/spiral.svg?react';
import { apiGetMapEvents } from 'mastodon/api/map';
import type { ApiMapEventPinJSON } from 'mastodon/api/map';
import { Icon } from 'mastodon/components/icon';

// Event layer — draws Kalendar event pins on top of the Mates map.
// Kept as its own module (not mixed into mates_view's clustering /
// anonymisation model) because events don't share those constraints:
// event locations are already visibility-gated at the Event level,
// aren't per-account presence, and don't participate in the "N here"
// people cluster.
//
// The layer also owns the `?event=<slug>` deep link — event_detail's
// location row now points at `/hub/map?event=<slug>`, and this module
// flies the map to that pin + opens its preview card on arrival.

// SVG markup for the spiral glyph used inside the event marker bulb.
// Inlined so the marker DOM (which MapLibre owns) can render without
// pulling the React icon component in.
const SPIRAL_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960' fill='currentColor'><path d='M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q75 0 141 26t118 71.5Q791-737 820.5-676T860-540q0 55-21 102t-57.5 82.5Q745-320 697.5-299T595-278q-45 0-84.5-16.5T441-341q-30-30-46.5-69.5T378-495q0-32 12-60.5t33.5-50Q445-627 473-639t60-12q22 0 43 8t39 24q17 15 26.5 36.5T651-535q0 14-5.5 27T630-484q-10 10-22.5 15.5T582-463q-6 0-11-2t-9-6q-4-4-6.5-9.5T553-493q0-13 9-22t22-9q-1-16-12-27t-27-11q-19 0-33.5 8.5T487-529q-11 15-17 33t-6 38q0 45 32.5 76.5T574-350q40 0 74.5-16.5t60.5-45q26-28.5 40-67T763-560q0-49-19-92.5T692-729q-33-33-77-52t-95-19q-56 0-105.5 21T329-720q-36 36-57 85.5T251-529q0 61 23 115t63.5 94.5Q378-279 432-256t115 23q68 0 129-26t106.5-71.5Q828-376 855-437.5T882-570q0-83-32.5-156.5T760-855q-56-55-131.5-87T466-974q-85 0-158.5 32T177-855q-56 55-88.5 128.5T56-570q0 88 33.5 164T182-273q59 59 138 91.5T480-149q57 0 108.5-15T682-207l45 45q-53 40-115 61T480-80Z'/></svg>";

// Marker DOM — vanilla DOM (MapLibre owns positioning). Spiral glyph
// in a purple square bulb; the huddle variant swaps to a videocam.
const buildEventMarker = (pin: ApiMapEventPinJSON): HTMLElement => {
  const el = document.createElement('div');
  el.className = 'map-event-pin';
  el.title = pin.title;
  if (pin.event_type === 'huddle') el.classList.add('map-event-pin--huddle');
  const bulb = document.createElement('div');
  bulb.className = 'map-event-pin__bulb';
  bulb.innerHTML = SPIRAL_SVG;
  el.appendChild(bulb);
  return el;
};

interface Props {
  map: maplibregl.Map | null;
  ready: boolean;
}

export const EventLayer: React.FC<Props> = ({ map, ready }) => {
  const [events, setEvents] = useState<ApiMapEventPinJSON[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const location = useLocation();

  // Read `?event=<slug>` — the deep link that focuses the map on a
  // specific event's pin. Recomputed on URL change so a navigation
  // within the SPA (e.g. back → different event) re-triggers the fly.
  const requestedSlug = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('event');
  }, [location.search]);

  // ── Fetch events on mount ────────────────────────────────────────
  useEffect(() => {
    void apiGetMapEvents()
      .then(setEvents)
      .catch(() => undefined);
  }, []);

  // ── Render markers ───────────────────────────────────────────────
  useEffect(() => {
    if (!map || !ready) return;

    // Tear down previous markers before re-render so a fetch refresh
    // doesn't accumulate ghosts.
    markersRef.current.forEach((m) => {
      m.remove();
    });
    markersRef.current = [];

    markersRef.current = events.map((pin) => {
      const el = buildEventMarker(pin);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedSlug(pin.slug);
        map.flyTo({
          center: [pin.lng, pin.lat],
          zoom: Math.min(Math.max(map.getZoom(), 12), 15),
          duration: 700,
        });
      });
      return new maplibregl.Marker({ element: el })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map);
    });

    return () => {
      markersRef.current.forEach((m) => {
        m.remove();
      });
      markersRef.current = [];
    };
  }, [events, map, ready]);

  // ── Handle ?event=<slug> deep link ───────────────────────────────
  useEffect(() => {
    if (!map || !ready || !requestedSlug) return;
    const target = events.find((e) => e.slug === requestedSlug);
    if (!target) return;
    setSelectedSlug(target.slug);
    map.flyTo({
      center: [target.lng, target.lat],
      zoom: target.zoom ?? 14,
      duration: 900,
    });
  }, [requestedSlug, events, map, ready]);

  const selected = useMemo(
    () => events.find((e) => e.slug === selectedSlug) ?? null,
    [events, selectedSlug],
  );

  const handleClose = useCallback(() => {
    setSelectedSlug(null);
  }, []);

  if (!selected) return null;

  return <EventPreviewCard event={selected} onClose={handleClose} />;
};

const EventPreviewCard: React.FC<{
  event: ApiMapEventPinJSON;
  onClose: () => void;
}> = ({ event, onClose }) => (
  <div className='map-event-card' role='dialog' aria-label={event.title}>
    <button
      type='button'
      className='map-event-card__close'
      onClick={onClose}
      aria-label='Close'
    >
      <Icon id='close' icon={CloseIcon} />
    </button>
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
      {event.location_name && (
        <div className='map-event-card__location'>{event.location_name}</div>
      )}
      <Link to={`/kalendar/${event.slug}`} className='map-event-card__open'>
        Open in Kalendar →
      </Link>
    </div>
  </div>
);
