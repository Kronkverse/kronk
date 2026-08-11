import { useEffect, useRef, useState, useCallback } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { useHistory, useLocation } from 'react-router-dom';

import * as maplibregl from 'maplibre-gl';

import 'maplibre-gl/dist/maplibre-gl.css';

import {
  apiGetTreks,
  apiGetTrek,
  apiPublishTrek,
  apiUnpublishTrek,
  apiDeleteTrek,
} from 'mastodon/api/map_treks';
import type {
  ApiTrekJSON,
  TrekActivity,
  TrekReach,
} from 'mastodon/api/map_treks';
import { Button } from 'mastodon/components/button';
import { LoadingIndicator } from 'mastodon/components/loading_indicator';
import { ReachDropdown } from 'mastodon/components/reach_dropdown';
import type { ReachValue } from 'mastodon/components/reach_dropdown';
import { StatusTrekCard } from 'mastodon/components/status_trek_card';

import { BASEMAP_URL, basemapLayers, ensurePmtilesProtocol } from './basemap';
import { TrekComments } from './trek_comments';
import { TrekFroth } from './trek_froth';

// Map — Treks lens. Lists the caller's own treks and their Mates' published
// treks (Mates-gated server-side), with a detail view drawing the privacy-
// trimmed route on the shared Kronk basemap plus the stats.

const messages = defineMessages({
  yours: { id: 'map.treks.yours', defaultMessage: 'Yours' },
  mates: { id: 'map.treks.mates', defaultMessage: 'Mates' },
  empty: { id: 'map.treks.empty', defaultMessage: 'No treks yet.' },
  back: { id: 'map.treks.back', defaultMessage: 'Back' },
  publish: { id: 'map.treks.publish', defaultMessage: 'Publish' },
  unpublish: { id: 'map.treks.unpublish', defaultMessage: 'Make private' },
  remove: { id: 'map.treks.delete', defaultMessage: 'Delete' },
  shareWith: { id: 'map.treks.share_with', defaultMessage: 'Share with' },
  shared: {
    id: 'map.treks.shared',
    defaultMessage: 'Shared to your timeline.',
  },
});

const ACTIVITY_GLYPH: Record<TrekActivity, string> = {
  run: '🏃',
  walk: '🚶',
  hike: '🥾',
  swim: '🏊',
  ride: '🚴',
  paddle: '🛶',
};

const km = (m: number) => (m / 1000).toFixed(1);

const duration = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const metric = (trek: ApiTrekJSON) => {
  if (trek.pace_seconds) {
    const m = Math.floor(trek.pace_seconds / 60);
    const s = Math.round(trek.pace_seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}/km`;
  }
  if (trek.speed_kmh) return `${trek.speed_kmh.toFixed(1)} km/h`;
  return null;
};

// The route drawn on a mini basemap, fit to its bounds.
const TrekRouteMap: React.FC<{ route: [number, number][] }> = ({ route }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    ensurePmtilesProtocol();
    const container = containerRef.current;
    if (!container || mapRef.current || route.length < 2) return;

    const map = new maplibregl.Map({
      container,
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
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(container);

    map.on('load', () => {
      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: route },
        },
      });
      // A dark casing under a bright core so the track reads on both the
      // purple land and the white roads (a plain white line vanishes on the
      // roads).
      map.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#241546', 'line-width': 6 },
      });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ff5c93', 'line-width': 3 },
      });
      const lngs = route.map((p) => p[0]);
      const lats = route.map((p) => p[1]);
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 32, animate: false },
      );
    });

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [route]);

  return <div ref={containerRef} className='trek-detail__map' />;
};

const TrekDetail: React.FC<{
  trek: ApiTrekJSON;
  onBack: () => void;
  onChange: (t: ApiTrekJSON | null) => void;
}> = ({ trek, onBack, onChange }) => {
  const intl = useIntl();

  const [reach, setReach] = useState<TrekReach>('mates');
  // ReachDropdown emits the full ladder; krew is hidden here, so the value is
  // always one of the TrekReach rungs (self_only/mates/orbit/public).
  const onReach = useCallback((value: ReachValue) => {
    setReach(value as TrekReach);
  }, []);
  const publish = useCallback(() => {
    void apiPublishTrek(trek.id, reach).then(onChange);
  }, [trek.id, reach, onChange]);
  const unpublish = useCallback(() => {
    void apiUnpublishTrek(trek.id).then(onChange);
  }, [trek.id, onChange]);

  const remove = useCallback(() => {
    void apiDeleteTrek(trek.id).then(() => {
      onChange(null);
    });
  }, [trek.id, onChange]);

  const pace = metric(trek);

  return (
    <div className='trek-detail'>
      <button type='button' className='trek-detail__back' onClick={onBack}>
        ← {intl.formatMessage(messages.back)}
      </button>

      <h2 className='trek-detail__title'>
        {ACTIVITY_GLYPH[trek.activity_type]} {trek.title || trek.activity_type}
      </h2>

      {trek.has_route && trek.route ? (
        <TrekRouteMap route={trek.route} />
      ) : (
        <p className='trek-detail__noroute'>
          <FormattedMessage
            id='map.treks.no_route'
            defaultMessage='No route — the numbers only.'
          />
        </p>
      )}

      <dl className='trek-detail__stats'>
        <div>
          <dt>
            <FormattedMessage
              id='map.treks.distance'
              defaultMessage='Distance'
            />
          </dt>
          <dd>{km(trek.distance_m)} km</dd>
        </div>
        <div>
          <dt>
            <FormattedMessage id='map.treks.time' defaultMessage='Time' />
          </dt>
          <dd>{duration(trek.moving_sec)}</dd>
        </div>
        {pace && (
          <div>
            <dt>
              <FormattedMessage id='map.treks.pace' defaultMessage='Pace' />
            </dt>
            <dd>{pace}</dd>
          </div>
        )}
        {trek.elevation_gain != null && (
          <div>
            <dt>
              <FormattedMessage id='map.treks.climb' defaultMessage='Climb' />
            </dt>
            <dd>{trek.elevation_gain} m</dd>
          </div>
        )}
      </dl>

      {trek.trimmed_m > 0 && (
        <p className='trek-detail__privacy'>
          <FormattedMessage
            id='map.treks.trimmed'
            defaultMessage='{m} m trimmed from the ends for privacy — the route starts and finishes away from home.'
            values={{ m: trek.trimmed_m }}
          />
        </p>
      )}

      {trek.self && trek.state === 'published' && (
        <>
          <p className='trek-detail__shared'>
            {intl.formatMessage(messages.shared)}
          </p>
          <div className='trek-detail__actions'>
            <Button secondary onClick={unpublish}>
              {intl.formatMessage(messages.unpublish)}
            </Button>
            <Button className='button--destructive' onClick={remove}>
              {intl.formatMessage(messages.remove)}
            </Button>
          </div>
        </>
      )}

      {trek.self && trek.state !== 'published' && (
        <div className='trek-detail__actions'>
          <div className='trek-detail__reach'>
            <span>{intl.formatMessage(messages.shareWith)}</span>
            <ReachDropdown value={reach} onChange={onReach} />
          </div>
          <Button onClick={publish}>
            {intl.formatMessage(messages.publish)}
          </Button>
          <Button className='button--destructive' onClick={remove}>
            {intl.formatMessage(messages.remove)}
          </Button>
        </div>
      )}

      {/* Engagement on the published trek's Status: froth = Favourite,
          comments = replies. The same interactions as the feed, so they stay
          in sync both ways. Shown to anyone who can see the trek. */}
      {trek.state === 'published' && trek.status_id && (
        <>
          <TrekFroth statusId={trek.status_id} />
          <TrekComments
            statusId={trek.status_id}
            visibility={trek.visibility}
          />
        </>
      )}
    </div>
  );
};

// The selected trek's id lives in the URL (/hub/map/treks/:id) so the feed
// card can deep-link straight to a trek's detail in the Map space.
const TREK_ID_RE = /^\/hub\/map\/treks\/([^/]+)/;

export const TreksView: React.FC = () => {
  const intl = useIntl();
  const history = useHistory();
  const location = useLocation();
  const [treks, setTreks] = useState<ApiTrekJSON[] | null>(null);
  const [filterMine, setFilterMine] = useState(true);
  const [detail, setDetail] = useState<ApiTrekJSON | null>(null);

  const selectedId = TREK_ID_RE.exec(location.pathname)?.[1] ?? null;

  const refresh = useCallback(() => {
    void apiGetTreks()
      .then(setTreks)
      .catch(() => {
        setTreks([]);
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Resolve the URL-selected trek independently of the list, so a deep link
  // to a trek not on the caller's current feed page still opens (server-side
  // Mates gate still applies — a non-visible trek 404s and clears the detail).
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    const fromList = treks?.find((t) => t.id === selectedId);
    if (fromList) {
      setDetail(fromList);
      return;
    }
    let live = true;
    void apiGetTrek(selectedId)
      .then((t) => {
        if (live) setDetail(t);
      })
      .catch(() => {
        if (live) setDetail(null);
      });
    return () => {
      live = false;
    };
  }, [selectedId, treks]);

  const showMine = useCallback(() => {
    setFilterMine(true);
  }, []);
  const showMates = useCallback(() => {
    setFilterMine(false);
  }, []);
  const back = useCallback(() => {
    history.push('/hub/map/treks');
  }, [history]);

  const onDetailChange = useCallback(
    (t: ApiTrekJSON | null) => {
      if (t === null) history.push('/hub/map/treks');
      refresh();
    },
    [history, refresh],
  );

  // A selected trek renders its detail as soon as it resolves — even before
  // the list load completes.
  if (selectedId) {
    if (detail) {
      return (
        <TrekDetail trek={detail} onBack={back} onChange={onDetailChange} />
      );
    }
    return (
      <div className='trek-list trek-list--loading'>
        <LoadingIndicator />
      </div>
    );
  }

  if (treks === null) {
    return (
      <div className='trek-list trek-list--loading'>
        <LoadingIndicator />
      </div>
    );
  }

  const visible = treks.filter((t) => t.self === filterMine);

  return (
    <div className='trek-list'>
      <div className='trek-list__filter'>
        <button
          type='button'
          className={filterMine ? 'is-active' : ''}
          onClick={showMine}
        >
          {intl.formatMessage(messages.yours)}
        </button>
        <button
          type='button'
          className={filterMine ? '' : 'is-active'}
          onClick={showMates}
        >
          {intl.formatMessage(messages.mates)}
        </button>
      </div>

      {visible.length === 0 ? (
        <p className='trek-list__empty'>{intl.formatMessage(messages.empty)}</p>
      ) : (
        // Cards match the feed's `StatusTrekCard` shape one-for-one
        // (route glimpse + stats), so a trek reads the same whether
        // you meet it in Home or here. Tapping opens the detail via
        // `to={/hub/map/treks/:id}` (baked into StatusTrekCard).
        // Draft treks render the same way; the detail view exposes
        // the publish / delete affordances.
        <ul className='trek-list__items'>
          {visible.map((trek) => (
            <li key={trek.id}>
              <StatusTrekCard trek={trek} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
