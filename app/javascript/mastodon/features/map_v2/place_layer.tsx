import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link, useLocation } from 'react-router-dom';

import * as maplibregl from 'maplibre-gl';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import LocationIcon from '@/material-icons/400-24px/location_on.svg?react';
import {
  apiGetAttachmentsBySource,
  apiGetAttachmentsByTarget,
} from 'mastodon/api/attachments';
import type { AttachmentEndpointPreview } from 'mastodon/api/attachments';
import { apiGetMapPlace, apiGetMapPlaces } from 'mastodon/api/map_places';
import type { ApiMapPlaceJSON } from 'mastodon/api/map_places';
import { Icon } from 'mastodon/components/icon';

// Places layer — draws Map Places (exact spots with an address, Map's
// linkable record) on the Mates map, beside the event layer. Tapping
// one opens a card listing what's Konnected to it, both ways, with a
// link to the Place's page. Owns the `?place=<id>` deep link, which
// flies the map to that Place and opens its card.
//
// Places load for the part of the world in view, and again when the
// map settles somewhere new.

const messages = defineMessages({
  close: { id: 'map.place_card.close', defaultMessage: 'Close' },
  open: { id: 'map.place_card.open', defaultMessage: 'Open place →' },
  konnected: {
    id: 'map.place_card.konnected',
    defaultMessage: 'Konnected',
  },
  nothing: {
    id: 'map.place_card.nothing',
    defaultMessage: 'Nothing Konnected yet.',
  },
  untitled: { id: 'map.place_card.untitled', defaultMessage: 'Untitled' },
});

const LOCATION_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960' fill='currentColor'><path d='M480-480q33 0 56.5-23.5T560-560q0-33-23.5-56.5T480-640q-33 0-56.5 23.5T400-560q0 33 23.5 56.5T480-480Zm0 400Q319-217 239.5-334.5T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 100-79.5 217.5T480-80Z'/></svg>";

const buildPlaceMarker = (place: ApiMapPlaceJSON): HTMLElement => {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'map-place-pin';
  el.title = place.name;
  el.setAttribute('aria-label', place.name);
  el.innerHTML = LOCATION_SVG;
  return el;
};

// Longitude back into -180..180 (the map's own runs on past it when
// panned round the world).
const wrapLng = (lng: number) => ((((lng + 180) % 360) + 360) % 360) - 180;

// `<west>,<south>,<east>,<north>` for what's in view. A box over the
// antimeridian comes out west > east, which the server reads as wrapping.
const boundsParam = (map: maplibregl.Map): string => {
  const b = map.getBounds();
  const wholeWorld = b.getEast() - b.getWest() >= 360;
  return [
    wholeWorld ? -180 : wrapLng(b.getWest()),
    Math.max(-90, b.getSouth()),
    wholeWorld ? 180 : wrapLng(b.getEast()),
    Math.min(90, b.getNorth()),
  ]
    .map((n) => n.toFixed(5))
    .join(',');
};

interface Props {
  map: maplibregl.Map | null;
  ready: boolean;
}

export const PlaceLayer: React.FC<Props> = ({ map, ready }) => {
  const [places, setPlaces] = useState<ApiMapPlaceJSON[]>([]);
  const [selected, setSelected] = useState<ApiMapPlaceJSON | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const location = useLocation();

  const requestedId = useMemo(
    () => new URLSearchParams(location.search).get('place'),
    [location.search],
  );

  // ── Load the Places in view, and again when the map settles ───────
  useEffect(() => {
    if (!map || !ready) return;
    let cancelled = false;
    const load = () => {
      void apiGetMapPlaces({ bbox: boundsParam(map), limit: 200 })
        .then((found) => {
          if (!cancelled) setPlaces(found);
        })
        .catch(() => undefined);
    };
    load();
    map.on('moveend', load);
    return () => {
      cancelled = true;
      map.off('moveend', load);
    };
  }, [map, ready]);

  // ── Markers ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!map || !ready) return;

    markersRef.current = places.map((place) => {
      const el = buildPlaceMarker(place);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelected(place);
      });
      return new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([place.longitude, place.latitude])
        .addTo(map);
    });

    return () => {
      markersRef.current.forEach((m) => {
        m.remove();
      });
      markersRef.current = [];
    };
  }, [places, map, ready]);

  // ── ?place=<id> deep link ─────────────────────────────────────────
  // Flies there; the Place then loads with the rest in view.
  useEffect(() => {
    if (!map || !ready || !requestedId) return;
    let cancelled = false;
    void apiGetMapPlace(requestedId)
      .then((place) => {
        if (cancelled) return;
        setSelected(place);
        map.flyTo({
          center: [place.longitude, place.latitude],
          zoom: 15,
          duration: 900,
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [requestedId, map, ready]);

  const handleClose = useCallback(() => {
    setSelected(null);
  }, []);

  if (!selected) return null;

  return (
    <PlacePreviewCard
      key={selected.id}
      place={selected}
      onClose={handleClose}
    />
  );
};

// What a Place card lists: every record Konnected to the Place, either
// way, once each (only what the viewer may see comes back).
const useKonnected = (placeId: string) => {
  const [items, setItems] = useState<AttachmentEndpointPreview[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      apiGetAttachmentsByTarget('map', placeId),
      apiGetAttachmentsBySource('map', placeId),
    ])
      .then(([to, from]) => {
        if (cancelled) return;
        const seen = new Set<string>();
        const ends = [
          ...to.map((a) => a.source),
          ...from.map((a) => a.target),
        ].filter((end) => {
          const key = `${end.slug}/${end.id ?? ''}`;
          if (end.missing || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setItems(ends);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [placeId]);

  return items;
};

const PlacePreviewCard: React.FC<{
  place: ApiMapPlaceJSON;
  onClose: () => void;
}> = ({ place, onClose }) => {
  const intl = useIntl();
  const konnected = useKonnected(place.id);

  return (
    <div
      className='map-event-card map-place-card'
      role='dialog'
      aria-label={place.name}
    >
      <button
        type='button'
        className='map-event-card__close'
        onClick={onClose}
        aria-label={intl.formatMessage(messages.close)}
      >
        <Icon id='close' icon={CloseIcon} />
      </button>
      <div className='map-event-card__body'>
        <div className='map-event-card__title'>
          <Icon
            id='location_on'
            icon={LocationIcon}
            className='map-event-card__type-icon'
          />
          {place.name}
        </div>
        {place.address && (
          <div className='map-place-card__address'>{place.address}</div>
        )}
        {konnected && (
          <div className='map-place-card__konnected'>
            <span className='map-place-card__label'>
              {intl.formatMessage(messages.konnected)}
            </span>
            {konnected.length === 0 ? (
              <span className='map-place-card__none'>
                {intl.formatMessage(messages.nothing)}
              </span>
            ) : (
              <ul>
                {konnected.map((end) => (
                  <li key={`${end.slug}/${end.id ?? ''}`}>
                    {end.url ? (
                      <Link to={end.url}>
                        {end.title ?? intl.formatMessage(messages.untitled)}
                      </Link>
                    ) : (
                      (end.title ?? intl.formatMessage(messages.untitled))
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <Link to={place.url} className='map-event-card__open'>
          {intl.formatMessage(messages.open)}
        </Link>
      </div>
    </div>
  );
};
