import { useMemo } from 'react';

import { defineMessages, useIntl } from 'react-intl';
import type { IntlShape } from 'react-intl';

import type { FtdEvent, FtdProject } from 'mastodon/api_types/freethedream';
import { SpaceShelf } from 'mastodon/components/space_shelf';
import type { ShelfCard } from 'mastodon/components/space_shelf';
import { parseOsmUrl } from 'mastodon/features/events/parse_osm_url';

// A projekt's Events, the same section as a Krew's (Tal, 2026-11-09: "i
// want it aligned so people don't have to recognise the same
// functionality with different names"): the Kalendar events made for the
// projekt or one of its Komponents that are still to come, soonest first,
// as the standard row of cards, each its picture, title and when (and the
// Komponent it's for). New makes one for this page (the whole projekt on
// its page, a Komponent on the Komponent's), and its composer offers Add
// existing (Kronk::EventLinks). Going is on the event's own page. The
// events themselves live in Kalendar; this reads them.

const messages = defineMessages({
  title: {
    id: 'freethedream.events.title',
    defaultMessage: 'Events',
  },
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

export const ProjectEvents: React.FC<{
  project: FtdProject;
  id?: string;
  refresh: () => void;
}> = ({ project, id, refresh }) => {
  const intl = useIntl();
  const cards = useMemo<ShelfCard[]>(
    () =>
      project.events.map((event) => {
        const when = eventWhen(intl, event);
        return {
          key: event.id,
          id: event.id,
          to: `/hub/kalendar/${event.slug}`,
          image: event.image_url,
          title: event.title,
          meta: [when.date, when.time, event.for?.title]
            .filter(Boolean)
            .join(' · '),
        };
      }),
    [project.events, intl],
  );

  return (
    <SpaceShelf
      homeSlug='freethedream'
      homeId={project.id}
      korner='kalendar'
      id={id}
      title={intl.formatMessage(messages.title)}
      canAdd={project.can.link_event}
      cards={cards}
      onAdded={refresh}
    />
  );
};
