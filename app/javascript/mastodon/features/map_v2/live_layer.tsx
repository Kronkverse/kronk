import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { useLocation } from 'react-router-dom';

import * as maplibregl from 'maplibre-gl';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import { apiGetLiveLocations } from 'mastodon/api/map_live';
import type { ApiLiveLocationJSON } from 'mastodon/api/map_live';
import { Icon } from 'mastodon/components/icon';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';

// Live layer — Mates sharing exactly where they are with you, from a linked
// Anthemos phone (docs/spaces/map.md, Live location). Unlike a pin, a live
// point is exact: the person named who sees it and for how long, and their
// phone signs every point. So it ignores the map's close-zoom hiding, and
// its card says where it came from. Owns `?live=<account id>`, the link in
// the "sharing their live location with you" nudge.

const POLL_MS = 20_000;

const messages = defineMessages({
  close: { id: 'map.live.close', defaultMessage: 'Close' },
  live: { id: 'map.live.badge', defaultMessage: 'Live' },
  title: {
    id: 'map.live.title',
    defaultMessage: '{name}, live',
  },
});

const buildLiveMarker = (live: ApiLiveLocationJSON): HTMLElement => {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'map-live';
  el.title = live.name;
  el.setAttribute('aria-label', live.name);
  const avatar = document.createElement('span');
  avatar.className = 'map-live__avatar';
  avatar.style.backgroundImage = `url("${live.avatar}")`;
  el.appendChild(avatar);
  return el;
};

interface Props {
  map: maplibregl.Map | null;
  ready: boolean;
}

export const LiveLayer: React.FC<Props> = ({ map, ready }) => {
  const [lives, setLives] = useState<ApiLiveLocationJSON[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const flownRef = useRef(false);
  const location = useLocation();

  const requested = useMemo(
    () => new URLSearchParams(location.search).get('live'),
    [location.search],
  );

  // ── Poll ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void apiGetLiveLocations()
        .then((found) => {
          if (!cancelled) setLives(found);
        })
        .catch(() => undefined);
    };
    load();
    const id = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  // ── Markers: moved in place so a tap target doesn't jump away ─────
  useEffect(() => {
    if (!map || !ready) return;
    const markers = markersRef.current;
    const seen = new Set<string>();

    lives.forEach((live) => {
      seen.add(live.account_id);
      const existing = markers.get(live.account_id);
      if (existing) {
        existing.setLngLat([live.lng, live.lat]);
        return;
      }
      const el = buildLiveMarker(live);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedId(live.account_id);
      });
      markers.set(
        live.account_id,
        new maplibregl.Marker({ element: el })
          .setLngLat([live.lng, live.lat])
          .addTo(map),
      );
    });

    markers.forEach((marker, id) => {
      if (seen.has(id)) return;
      marker.remove();
      markers.delete(id);
    });
  }, [lives, map, ready]);

  useEffect(() => {
    const markers = markersRef.current;
    return () => {
      markers.forEach((marker) => {
        marker.remove();
      });
      markers.clear();
    };
  }, []);

  // ── ?live=<account id>: fly there once it's loaded ───────────────
  useEffect(() => {
    if (!map || !ready || !requested || flownRef.current) return;
    const live = lives.find((l) => l.account_id === requested);
    if (!live) return;
    flownRef.current = true;
    setSelectedId(live.account_id);
    map.flyTo({ center: [live.lng, live.lat], zoom: 15, duration: 900 });
  }, [requested, lives, map, ready]);

  const handleClose = useCallback(() => {
    setSelectedId(null);
  }, []);

  const selected = lives.find((l) => l.account_id === selectedId);
  if (!selected) return null;

  return <LiveCard live={selected} onClose={handleClose} />;
};

const LiveCard: React.FC<{
  live: ApiLiveLocationJSON;
  onClose: () => void;
}> = ({ live, onClose }) => {
  const intl = useIntl();

  return (
    <div
      className='map-event-card map-live-card'
      role='dialog'
      aria-label={intl.formatMessage(messages.title, { name: live.name })}
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
          <span className='map-live-card__dot' aria-hidden />
          {live.name}
          <span className='map-live-card__live'>
            {intl.formatMessage(messages.live)}
          </span>
        </div>
        <div className='map-live-card__line'>
          <FormattedMessage
            id='map.live.updated'
            defaultMessage='Updated {when}, to within {metres} m'
            values={{
              when: <RelativeTimestamp timestamp={live.at} />,
              metres: live.accuracy,
            }}
          />
        </div>
        <div className='map-live-card__line'>
          <FormattedMessage
            id='map.live.until'
            defaultMessage='Sharing until {time}'
            values={{
              time: intl.formatTime(live.expires_at, {
                hour: 'numeric',
                minute: '2-digit',
              }),
            }}
          />
        </div>
        <a
          className='map-live-card__anthemos'
          href='https://anthemos.org'
          target='_blank'
          rel='noopener'
        >
          <FormattedMessage
            id='map.live.from_anthemos'
            defaultMessage='From Anthemos, signed by their phone'
          />
        </a>
      </div>
    </div>
  );
};
