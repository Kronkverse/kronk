import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import type * as maplibregl from 'maplibre-gl';

import ExploreIcon from '@/material-icons/400-24px/explore.svg?react';
import { apiGetMapEvents } from 'mastodon/api/map';
import type { ApiMapEventPinJSON, ApiPresencePinJSON } from 'mastodon/api/map';
import { apiGetMapPlaces } from 'mastodon/api/map_places';
import type { ApiMapPlaceJSON } from 'mastodon/api/map_places';
import { Icon } from 'mastodon/components/icon';

// Near me — one button that takes the map to your pin and lists what is
// closest: Mates, Places and Events (Kommons "map ideas", @mangobee,
// 2026-10-30). Distances are from your pin, which is already coarsened, so
// they are "about". Without a pin the button opens the place-a-pin panel.

const messages = defineMessages({
  button: { id: 'map.near_me.button', defaultMessage: 'Near me' },
  mates: { id: 'map.near_me.mates', defaultMessage: 'Mates' },
  places: { id: 'map.near_me.places', defaultMessage: 'Places' },
  events: { id: 'map.near_me.events', defaultMessage: 'Your Events' },
  km: { id: 'map.near_me.km', defaultMessage: 'about {km} km' },
  close: { id: 'map.near_me.close', defaultMessage: 'under 1 km' },
  nothing: {
    id: 'map.near_me.nothing',
    defaultMessage: 'Nothing close yet.',
  },
});

// How many of each, and how far to look for Places.
const SHOW = 5;
const PLACES_RADIUS_KM = 50;
// Close enough to see your streets, not so close the pins hide (ANON_ZOOM
// in mates_view.tsx).
const NEAR_ZOOM = 10;

const kmBetween = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
};

interface Near<T> {
  item: T;
  km: number;
}

const closest = <T,>(
  items: T[],
  at: (item: T) => [number, number],
  from: ApiPresencePinJSON,
): Near<T>[] =>
  items
    .map((item) => {
      const [lat, lng] = at(item);
      return { item, km: kmBetween(from.lat, from.lng, lat, lng) };
    })
    .sort((a, b) => a.km - b.km)
    .slice(0, SHOW);

const Distance: React.FC<{ km: number }> = ({ km }) => {
  const intl = useIntl();
  return (
    <span className='map-near-me__km'>
      {km < 1
        ? intl.formatMessage(messages.close)
        : intl.formatMessage(messages.km, {
            km: km < 10 ? km.toFixed(1) : Math.round(km),
          })}
    </span>
  );
};

interface Props {
  map: maplibregl.Map | null;
  selfPin: ApiPresencePinJSON | null;
  pins: ApiPresencePinJSON[];
  // Sits lower when the in-view panel takes the top-left corner.
  lower: boolean;
  onSelectPin: (pin: ApiPresencePinJSON) => void;
  onOpenPlace: () => void;
}

export const NearMe: React.FC<Props> = ({
  map,
  selfPin,
  pins,
  lower,
  onSelectPin,
  onOpenPlace,
}) => {
  const intl = useIntl();
  const history = useHistory();
  const [open, setOpen] = useState(false);
  const [places, setPlaces] = useState<ApiMapPlaceJSON[]>([]);
  const [events, setEvents] = useState<ApiMapEventPinJSON[]>([]);

  // What's near, fetched each time the list opens (your pin may have moved).
  useEffect(() => {
    if (!open || !selfPin) return;
    let cancelled = false;
    void apiGetMapPlaces({
      near: `${selfPin.lat},${selfPin.lng}`,
      radius_km: PLACES_RADIUS_KM,
      limit: 50,
    })
      .then((found) => {
        if (!cancelled) setPlaces(found);
      })
      .catch(() => undefined);
    void apiGetMapEvents()
      .then((found) => {
        if (!cancelled) setEvents(found);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, selfPin]);

  const toggle = useCallback(() => {
    if (!selfPin) {
      onOpenPlace();
      return;
    }
    if (!open)
      map?.flyTo({
        center: [selfPin.lng, selfPin.lat],
        zoom: NEAR_ZOOM,
        duration: 900,
      });
    setOpen(!open);
  }, [map, open, selfPin, onOpenPlace]);

  const nearMates = useMemo(
    () =>
      selfPin
        ? closest(
            pins.filter((p) => p.account_id !== selfPin.account_id),
            (p) => [p.lat, p.lng],
            selfPin,
          )
        : [],
    [pins, selfPin],
  );
  const nearPlaces = useMemo(
    () =>
      selfPin ? closest(places, (p) => [p.latitude, p.longitude], selfPin) : [],
    [places, selfPin],
  );
  const nearEvents = useMemo(
    () => (selfPin ? closest(events, (e) => [e.lat, e.lng], selfPin) : []),
    [events, selfPin],
  );

  const pickMate = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const pin = pins.find((p) => p.account_id === e.currentTarget.value);
      if (pin) onSelectPin(pin);
      setOpen(false);
    },
    [pins, onSelectPin],
  );
  const pickPlace = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      history.push({
        pathname: '/hub/map',
        search: `?map_place=${e.currentTarget.value}`,
      });
      setOpen(false);
    },
    [history],
  );
  const pickEvent = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      history.push({
        pathname: '/hub/map',
        search: `?event=${encodeURIComponent(e.currentTarget.value)}`,
      });
      setOpen(false);
    },
    [history],
  );

  const empty =
    nearMates.length === 0 &&
    nearPlaces.length === 0 &&
    nearEvents.length === 0;

  return (
    <div className={`map-near-me${lower ? ' map-near-me--lower' : ''}`}>
      <button
        type='button'
        className='map-near-me__toggle'
        onClick={toggle}
        aria-expanded={selfPin ? open : undefined}
      >
        <Icon id='explore' icon={ExploreIcon} />
        <span>{intl.formatMessage(messages.button)}</span>
      </button>
      {open && selfPin && (
        <div className='map-near-me__panel'>
          {empty && (
            <p className='map-near-me__empty'>
              <FormattedMessage {...messages.nothing} />
            </p>
          )}
          {nearMates.length > 0 && (
            <section>
              <h3 className='map-near-me__title'>
                {intl.formatMessage(messages.mates)}
              </h3>
              {nearMates.map(({ item, km }) => (
                <button
                  key={item.account_id}
                  type='button'
                  value={item.account_id}
                  onClick={pickMate}
                  className='map-near-me__row'
                >
                  <img
                    src={item.avatar}
                    alt=''
                    className='map-near-me__avatar'
                  />
                  <span className='map-near-me__name'>{item.name}</span>
                  <Distance km={km} />
                </button>
              ))}
            </section>
          )}
          {nearPlaces.length > 0 && (
            <section>
              <h3 className='map-near-me__title'>
                {intl.formatMessage(messages.places)}
              </h3>
              {nearPlaces.map(({ item, km }) => (
                <button
                  key={item.id}
                  type='button'
                  value={item.id}
                  onClick={pickPlace}
                  className='map-near-me__row'
                >
                  <span className='map-near-me__name'>{item.name}</span>
                  <Distance km={km} />
                </button>
              ))}
            </section>
          )}
          {nearEvents.length > 0 && (
            <section>
              <h3 className='map-near-me__title'>
                {intl.formatMessage(messages.events)}
              </h3>
              {nearEvents.map(({ item, km }) => (
                <button
                  key={item.id}
                  type='button'
                  value={item.slug}
                  onClick={pickEvent}
                  className='map-near-me__row'
                >
                  <span className='map-near-me__name'>{item.title}</span>
                  <Distance km={km} />
                </button>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
};
