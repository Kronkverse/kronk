import { lazy, Suspense, useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';
import type { IntlShape } from 'react-intl';

import { Link } from 'react-router-dom';

import { apiDeleteAttachment } from 'mastodon/api/attachments';
import { apiFtdRsvp } from 'mastodon/api/freethedream';
import type { FtdEvent } from 'mastodon/api_types/freethedream';
import { parseOsmUrl } from 'mastodon/features/events/parse_osm_url';
import { konnectSearch } from 'mastodon/hooks/useKonnect';
import { useKorner } from 'mastodon/hooks/useKorner';

// The Kalendar event a project happens at, on its Overview: its name, the
// map pin (which opens the Kronk Map), who's going, and your RSVP. When
// and where sit in the Overview's facts above it. The event itself lives
// in Kalendar; this reads it.

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
});

export const DATE: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
};
const TIME: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
};

// When an event is, as a date line and a time line: "Sat 6 Dec" over
// "10:00 – 16:00", or "Sat 6 Dec – Sun 7 Dec" over the start time.
export const eventWhen = (
  intl: IntlShape,
  event: Pick<FtdEvent, 'start_time' | 'end_time'>,
): { date: string; time: string } => {
  const start = new Date(event.start_time);
  const end = event.end_time ? new Date(event.end_time) : null;
  if (end && start.toDateString() !== end.toDateString())
    return {
      date: `${intl.formatDate(start, DATE)} – ${intl.formatDate(end, DATE)}`,
      time: intl.formatTime(start, TIME),
    };
  return {
    date: intl.formatDate(start, DATE),
    time: end
      ? `${intl.formatTime(start, TIME)} – ${intl.formatTime(end, TIME)}`
      : intl.formatTime(start, TIME),
  };
};

// The Map link for an event with a pin, or null.
export const eventMapHref = (event: FtdEvent) =>
  parseOsmUrl(event.location_url)
    ? `/hub/map?event=${encodeURIComponent(event.slug)}`
    : null;

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

// For the project's owner when there's no event yet: Kalendar's own
// composer, opened to Konnect what it makes to this project. Linking an
// event that already exists is the page's Konnect (decisions.md,
// 2026-10-27).
export const MakeEventPrompt: React.FC<{
  projectId: string;
}> = ({ projectId }) => {
  const intl = useIntl();
  const route = useKorner('kalendar')?.compose?.route;
  if (!route) return null;

  return (
    <div className='freethedream-event freethedream-event--empty'>
      <span className='freethedream__quiet'>
        {intl.formatMessage(messages.inPerson)}
      </span>
      <div className='freethedream-event__foot'>
        <Link
          to={{
            pathname: route,
            search: konnectSearch('freethedream', projectId),
          }}
          className='freethedream__button freethedream__button--small'
        >
          {intl.formatMessage(messages.make)}
        </Link>
      </div>
    </div>
  );
};
