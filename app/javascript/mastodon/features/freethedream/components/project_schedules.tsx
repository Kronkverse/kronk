import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import type { FtdEvent, FtdProject } from 'mastodon/api_types/freethedream';
import {
  fetchSchedule,
  ScheduleBody,
} from 'mastodon/features/events/event_schedule';
import type { Schedule } from 'mastodon/features/events/event_schedule';

import { eventWhen } from './event_card';

// A projekt's Schedule (docs/spaces/freethedream.md, Schedule; Tal,
// 2026-11-18): the schedule of each event in its Events, kept here by
// anyone in the projekt. The lines are the event's own, so the event's
// page shows the same ones (Kronk::EventSchedule). Under Events, a block
// for each event with one, and for members an Add for those without.
// Nothing at all when there's no schedule and nobody here can start one.

const messages = defineMessages({
  title: { id: 'freethedream.schedule.title', defaultMessage: 'Schedule' },
});

export const ProjectSchedules: React.FC<{ project: FtdProject }> = ({
  project,
}) => {
  const intl = useIntl();
  const [schedules, setSchedules] = useState<Record<string, Schedule>>({});

  const eventIds = project.events.map((event) => event.id).join(',');
  useEffect(() => {
    let live = true;
    const ids = eventIds ? eventIds.split(',') : [];
    void Promise.all(
      ids.map((id) =>
        fetchSchedule(id)
          .then((schedule) => [id, schedule] as const)
          .catch(() => null),
      ),
    ).then((found) => {
      if (!live) return;
      setSchedules(Object.fromEntries(found.filter((entry) => entry !== null)));
    });
    return () => {
      live = false;
    };
  }, [eventIds]);

  const handleChange = useCallback((id: string, schedule: Schedule) => {
    setSchedules((current) => ({ ...current, [id]: schedule }));
  }, []);

  const shown = project.events.filter((event) => {
    const schedule = schedules[event.id];
    return schedule && (schedule.lines.length > 0 || schedule.can_edit);
  });
  if (shown.length === 0) return null;

  return (
    <section className='event-schedule event-schedule--projekt'>
      <h3 className='korner-section-heading'>
        {intl.formatMessage(messages.title)}
      </h3>
      {shown.map((event) => (
        <EventBlock
          key={event.id}
          event={event}
          schedule={schedules[event.id]}
          onChange={handleChange}
        />
      ))}
    </section>
  );
};

const EventBlock: React.FC<{
  event: FtdEvent;
  schedule: Schedule | undefined;
  onChange: (id: string, schedule: Schedule) => void;
}> = ({ event, schedule, onChange }) => {
  const intl = useIntl();
  const handleChange = useCallback(
    (next: Schedule) => {
      onChange(event.id, next);
    },
    [onChange, event.id],
  );
  if (!schedule) return null;

  return (
    <div className='event-schedule__event'>
      <p className='event-schedule__event-title'>
        <Link to={`/hub/kalendar/${event.slug}`}>{event.title}</Link>
        <span className='event-schedule__event-when'>
          {eventWhen(intl, event).date}
        </span>
      </p>
      <ScheduleBody
        eventId={event.id}
        startTime={event.start_time}
        endTime={event.end_time}
        schedule={schedule}
        onChange={handleChange}
      />
    </div>
  );
};
