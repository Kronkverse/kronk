import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';
import type { IntlShape } from 'react-intl';

import { Link } from 'react-router-dom';

import { apiDeleteAttachment } from 'mastodon/api/attachments';
import { apiFtdRsvp } from 'mastodon/api/freethedream';
import type { FtdEvent, FtdProject } from 'mastodon/api_types/freethedream';
import { parseOsmUrl } from 'mastodon/features/events/parse_osm_url';
import { konnectSearch } from 'mastodon/hooks/useKonnect';
import { useKorner } from 'mastodon/hooks/useKorner';

import { projectPath, Section } from './shared';

// Getting together (Tal, 2026-10-30): the Kalendar events made for a
// projekt or for one of its Komponents, soonest first, each a date tile
// with its time, place and who's going, and one tap to say you're going.
// On a projekt's page the Komponents' events show too, tagged with the
// Komponent. Anyone in the projekt can make one, for the whole projekt or
// for one Komponent: Kalendar's own composer opens with that part
// Konnected, so the event belongs to it and its Krew hears about it
// (Kronk::EventLinks). The events themselves live in Kalendar; this reads
// them.

const messages = defineMessages({
  title: {
    id: 'freethedream.together.title',
    defaultMessage: 'Getting together',
  },
  empty: {
    id: 'freethedream.together.empty',
    defaultMessage:
      'A meetup, a working session, a launch: make an event and everyone in the Krew can see it and come.',
  },
  make: { id: 'freethedream.event.make', defaultMessage: 'Make an event' },
  forWhole: {
    id: 'freethedream.together.for_whole',
    defaultMessage: 'For the whole projekt',
  },
  forPart: {
    id: 'freethedream.together.for_part',
    defaultMessage: 'For {title}',
  },
  forLabel: {
    id: 'freethedream.together.for_label',
    defaultMessage: 'Who the event is for',
  },
  going: { id: 'freethedream.event.going', defaultMessage: 'Going' },
  imGoing: {
    id: 'freethedream.together.im_going',
    defaultMessage: "I'm going",
  },
  goingCount: {
    id: 'freethedream.together.going_count',
    defaultMessage: '{count} going',
  },
  unlink: { id: 'freethedream.event.unlink', defaultMessage: 'Unlink' },
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

export const GettingTogether: React.FC<{
  project: FtdProject;
  refresh: () => void;
}> = ({ project, refresh }) => {
  const intl = useIntl();
  const route = useKorner('kalendar')?.compose?.route;
  const [forId, setForId] = useState(project.id);
  const canMake = project.can.link_event && !!route;

  const handleFor = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setForId(e.target.value);
  }, []);

  if (project.events.length === 0 && !canMake) return null;

  return (
    <Section title={intl.formatMessage(messages.title)}>
      {project.events.length === 0 ? (
        <p className='freethedream__quiet'>
          {intl.formatMessage(messages.empty)}
        </p>
      ) : (
        <ul className='freethedream-together'>
          {project.events.map((event) => (
            <EventRow key={event.id} event={event} onChange={refresh} />
          ))}
        </ul>
      )}

      {canMake && route && (
        <div className='freethedream-together__make'>
          {project.sections.length > 0 && (
            <select
              className='freethedream__input freethedream__input--inline'
              value={forId}
              onChange={handleFor}
              aria-label={intl.formatMessage(messages.forLabel)}
            >
              <option value={project.id}>
                {project.top
                  ? intl.formatMessage(messages.forWhole)
                  : intl.formatMessage(messages.forPart, {
                      title: project.title,
                    })}
              </option>
              {project.sections.map((part) => (
                <option key={part.id} value={part.id}>
                  {intl.formatMessage(messages.forPart, { title: part.title })}
                </option>
              ))}
            </select>
          )}
          <Link
            to={{
              pathname: route,
              search: konnectSearch('freethedream', forId),
            }}
            className='freethedream__button freethedream__button--small'
          >
            {intl.formatMessage(messages.make)}
          </Link>
        </div>
      )}
    </Section>
  );
};

const EventRow: React.FC<{
  event: FtdEvent;
  onChange: () => void;
}> = ({ event, onChange }) => {
  const intl = useIntl();
  const [busy, setBusy] = useState(false);
  const start = new Date(event.start_time);
  const when = eventWhen(intl, event);
  const mapHref = eventMapHref(event);
  const going = event.my_rsvp === 'going';
  const href = `/hub/kalendar/${event.slug}`;

  const handleGoing = useCallback(() => {
    setBusy(true);
    apiFtdRsvp(event.id, going ? 'remove' : 'going')
      .then(() => {
        setBusy(false);
        onChange();
      })
      .catch(() => {
        setBusy(false);
      });
  }, [event.id, going, onChange]);

  const handleUnlink = useCallback(() => {
    void apiDeleteAttachment(event.attachment_id).then(onChange);
  }, [event.attachment_id, onChange]);

  return (
    <li className='freethedream-together__event'>
      <Link
        to={href}
        className='freethedream-together__date'
        tabIndex={-1}
        aria-hidden
      >
        <span className='freethedream-together__month'>
          {intl.formatDate(start, { month: 'short' })}
        </span>
        <span className='freethedream-together__day'>
          {intl.formatDate(start, { day: 'numeric' })}
        </span>
      </Link>

      <div className='freethedream-together__body'>
        <Link to={href} className='freethedream-together__title'>
          {event.title}
        </Link>
        <span className='freethedream-together__meta'>
          {when.date}, {when.time}
          {event.location_name && (
            <>
              {' · '}
              {mapHref ? (
                <Link to={mapHref}>{event.location_name}</Link>
              ) : (
                event.location_name
              )}
            </>
          )}
        </span>
        <span className='freethedream-together__foot'>
          {event.for && (
            <Link
              to={projectPath(event.for)}
              className='freethedream-tag freethedream-tag--flush'
            >
              {event.for.title}
            </Link>
          )}
          <span className='freethedream__quiet'>
            {intl.formatMessage(messages.goingCount, {
              count: event.going_count,
            })}
          </span>
          {event.can_unlink && (
            <button
              type='button'
              className='freethedream__link'
              onClick={handleUnlink}
            >
              {intl.formatMessage(messages.unlink)}
            </button>
          )}
        </span>
      </div>

      {event.rsvp_enabled && (
        <button
          type='button'
          className={
            going
              ? 'freethedream__button freethedream__button--small'
              : 'freethedream__button freethedream__button--small freethedream__button--quiet'
          }
          aria-pressed={going}
          disabled={busy}
          onClick={handleGoing}
        >
          {intl.formatMessage(going ? messages.going : messages.imGoing)}
        </button>
      )}
    </li>
  );
};
