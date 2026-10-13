import { lazy, Suspense, useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import { apiRequestGet } from 'mastodon/api';
import { apiDeleteAttachment } from 'mastodon/api/attachments';
import { apiFtdLinkEvent, apiFtdRsvp } from 'mastodon/api/freethedream';
import type { FtdEvent } from 'mastodon/api_types/freethedream';
import { parseOsmUrl } from 'mastodon/features/events/parse_osm_url';
import { EventComposer } from 'mastodon/features/kalendar/event_composer';
import type { CreatedEvent } from 'mastodon/features/kalendar/event_composer';

import { errorOf } from './shared';

// The Kalendar event a project happens at, on its Overview: when, where
// (with the map pin, which opens the Kronk Map), who's going, and your
// RSVP. The event itself lives in Kalendar; this reads it.

// MapLibre is heavy: load the preview only when there's a pin to show.
const MapPinPreview = lazy(() =>
  import('mastodon/components/map_pin_preview').then((m) => ({
    default: m.MapPinPreview,
  })),
);

const messages = defineMessages({
  kalendar: { id: 'freethedream.event.kalendar', defaultMessage: 'Kalendar' },
  going: { id: 'freethedream.event.going', defaultMessage: 'Going' },
  interested: {
    id: 'freethedream.event.interested',
    defaultMessage: 'Interested',
  },
  counts: {
    id: 'freethedream.event.counts',
    defaultMessage: '{going} going · {interested} interested',
  },
  unlink: {
    id: 'freethedream.event.unlink',
    defaultMessage: 'Unlink this event',
  },
  openMap: {
    id: 'freethedream.event.open_map',
    defaultMessage: 'Open {place} on the Map',
  },
  inPerson: {
    id: 'freethedream.event.in_person',
    defaultMessage: 'Happening in person?',
  },
  make: { id: 'freethedream.event.make', defaultMessage: 'Make the event' },
  linkMine: {
    id: 'freethedream.event.link_mine',
    defaultMessage: 'Or link one of your events',
  },
});

const DATE: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
};
const TIME: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
};

export const EventCard: React.FC<{
  event: FtdEvent;
  onChange: () => void;
}> = ({ event, onChange }) => {
  const intl = useIntl();
  const [busy, setBusy] = useState(false);
  const pin = parseOsmUrl(event.location_url);
  const mapHref = `/hub/map?event=${encodeURIComponent(event.slug)}`;

  const handleRsvp = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const choice =
        e.currentTarget.dataset.status === 'going' ? 'going' : 'interested';
      setBusy(true);
      apiFtdRsvp(event.id, event.my_rsvp === choice ? 'remove' : choice)
        .then(() => {
          setBusy(false);
          onChange();
        })
        .catch(() => {
          setBusy(false);
        });
    },
    [event.id, event.my_rsvp, onChange],
  );

  const handleUnlink = useCallback(() => {
    void apiDeleteAttachment(event.attachment_id).then(onChange);
  }, [event.attachment_id, onChange]);

  const start = new Date(event.start_time);
  const end = event.end_time ? new Date(event.end_time) : null;
  const sameDay = end && start.toDateString() === end.toDateString();
  const when = end
    ? sameDay
      ? `${intl.formatDate(start, DATE)}, ${intl.formatTime(start, TIME)} – ${intl.formatTime(end, TIME)}`
      : `${intl.formatDate(start, DATE)} – ${intl.formatDate(end, DATE)}`
    : `${intl.formatDate(start, DATE)}, ${intl.formatTime(start, TIME)}`;

  return (
    <div className='freethedream-event'>
      <div className='freethedream-event__body'>
        <span className='freethedream-event__kind'>
          {intl.formatMessage(messages.kalendar)}
        </span>
        <Link
          to={`/hub/kalendar/${event.slug}`}
          className='freethedream-event__title'
        >
          {event.title}
        </Link>
        <span className='freethedream-event__when'>{when}</span>
        {event.location_name &&
          (pin ? (
            <Link to={mapHref} className='freethedream-event__where'>
              {event.location_name}
            </Link>
          ) : (
            <span className='freethedream-event__where'>
              {event.location_name}
            </span>
          ))}
      </div>

      {pin && (
        <Link
          to={mapHref}
          className='freethedream-event__map'
          aria-label={intl.formatMessage(messages.openMap, {
            place: event.location_name ?? event.title,
          })}
        >
          <Suspense fallback={null}>
            <MapPinPreview lat={pin.lat} lng={pin.lng} zoom={pin.zoom} />
          </Suspense>
        </Link>
      )}

      <div className='freethedream-event__foot'>
        <span className='freethedream__quiet'>
          {intl.formatMessage(messages.counts, {
            going: event.going_count,
            interested: event.interested_count,
          })}
        </span>
        {event.rsvp_enabled && (
          <span className='freethedream-event__rsvp'>
            <button
              type='button'
              className={
                event.my_rsvp === 'going'
                  ? 'freethedream__button freethedream__button--small'
                  : 'freethedream__button freethedream__button--small freethedream__button--quiet'
              }
              data-status='going'
              aria-pressed={event.my_rsvp === 'going'}
              disabled={busy}
              onClick={handleRsvp}
            >
              {intl.formatMessage(messages.going)}
            </button>
            <button
              type='button'
              className={
                event.my_rsvp === 'interested'
                  ? 'freethedream__button freethedream__button--small'
                  : 'freethedream__button freethedream__button--small freethedream__button--quiet'
              }
              data-status='interested'
              aria-pressed={event.my_rsvp === 'interested'}
              disabled={busy}
              onClick={handleRsvp}
            >
              {intl.formatMessage(messages.interested)}
            </button>
          </span>
        )}
      </div>

      {event.can_unlink && (
        <button
          type='button'
          className='freethedream__link'
          onClick={handleUnlink}
        >
          {intl.formatMessage(messages.unlink)}
        </button>
      )}
    </div>
  );
};

interface MyEvent {
  id: string;
  title: string;
  start_time: string;
}

// For the project's owner when there's no event yet: make one in Kalendar's
// own composer, or link one they already made. Either way the link is a
// korner attachment from the event.
export const EventLinker: React.FC<{
  projectId: string;
  onLinked: () => void;
}> = ({ projectId, onLinked }) => {
  const intl = useIntl();
  const [composing, setComposing] = useState(false);
  const [mine, setMine] = useState<MyEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequestGet<MyEvent[]>('v1/events', { filter: 'mine' })
      .then((events) => {
        const now = Date.now();
        setMine(
          events
            .filter((e) => new Date(e.start_time).getTime() >= now)
            .sort((a, b) => a.start_time.localeCompare(b.start_time)),
        );
      })
      .catch(() => {
        setMine([]);
      });
  }, []);

  const link = useCallback(
    (eventId: string) => {
      setError(null);
      apiFtdLinkEvent(projectId, eventId)
        .then(onLinked)
        .catch((err: unknown) => {
          setError(errorOf(err));
        });
    },
    [projectId, onLinked],
  );

  const open = useCallback(() => {
    setComposing(true);
  }, []);
  const close = useCallback(() => {
    setComposing(false);
  }, []);
  const handleCreated = useCallback(
    (event: CreatedEvent) => {
      setComposing(false);
      link(event.id);
    },
    [link],
  );
  const handlePick = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (e.target.value) link(e.target.value);
    },
    [link],
  );

  return (
    <div className='freethedream-event freethedream-event--empty'>
      <span className='freethedream__quiet'>
        {intl.formatMessage(messages.inPerson)}
      </span>
      <div className='freethedream-event__foot'>
        <button
          type='button'
          className='freethedream__button freethedream__button--small'
          onClick={open}
        >
          {intl.formatMessage(messages.make)}
        </button>
        {mine.length > 0 && (
          <select
            className='freethedream__input freethedream__input--inline'
            value=''
            onChange={handlePick}
            aria-label={intl.formatMessage(messages.linkMine)}
          >
            <option value=''>{intl.formatMessage(messages.linkMine)}</option>
            {mine.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title} · {intl.formatDate(e.start_time, DATE)}
              </option>
            ))}
          </select>
        )}
      </div>
      {error && (
        <p className='freethedream__error' role='alert'>
          {error}
        </p>
      )}
      {composing && (
        <EventComposer onCancel={close} onCreated={handleCreated} />
      )}
    </div>
  );
};
