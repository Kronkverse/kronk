import { useMemo } from 'react';

import { defineMessages, useIntl } from 'react-intl';
import type { IntlShape } from 'react-intl';

import type { ApiListingBookingJSON } from 'mastodon/api_types/wachuneed';

// What a listing's booking asks for, on its page (docs/spaces/wachuneed.md,
// Booking): how long it takes, when the seller is free (weekly hours in
// their own time zone, and the times they posted, in yours), and what else
// the person booking gives. Nothing shows for a listing had by asking.

const messages = defineMessages({
  heading: {
    id: 'wachuneed.booking.summary.heading',
    defaultMessage: 'Booking',
  },
  length: { id: 'wachuneed.booking.summary.length', defaultMessage: 'Takes' },
  minutes: {
    id: 'wachuneed.booking.summary.minutes',
    defaultMessage: '{minutes, plural, one {# minute} other {# minutes}}',
  },
  hours: { id: 'wachuneed.booking.summary.hours', defaultMessage: 'Hours' },
  hoursZone: {
    id: 'wachuneed.booking.summary.hours_zone',
    defaultMessage: 'Hours ({zone} time)',
  },
  slots: { id: 'wachuneed.booking.summary.slots', defaultMessage: 'Times' },
  when: { id: 'wachuneed.booking.summary.when', defaultMessage: 'When' },
  suggest: {
    id: 'wachuneed.booking.summary.suggest',
    defaultMessage: 'Suggest a time that suits you',
  },
  route: { id: 'wachuneed.booking.summary.route', defaultMessage: 'Where' },
  routeBody: {
    id: 'wachuneed.booking.summary.route_body',
    defaultMessage: 'A from and a to, on the Map',
  },
  ask: { id: 'wachuneed.booking.summary.ask', defaultMessage: 'Tell them' },
});

// 2026-11-01 was a Sunday: day 0, as the server counts them.
const A_SUNDAY = Date.UTC(2026, 10, 1);

// An HH:MM of the seller's hours, written the way this reader's clock is.
const clock = (intl: IntlShape, time: string) => {
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  return intl.formatTime(Date.UTC(2026, 10, 1, hour, minute), {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  });
};

export const ListingBookingSummary: React.FC<{
  booking: ApiListingBookingJSON;
}> = ({ booking }) => {
  const intl = useIntl();
  const parts = booking.parts ?? [];

  const dayNames = useMemo(() => {
    const format = new Intl.DateTimeFormat(intl.locale, {
      weekday: 'long',
      timeZone: 'UTC',
    });
    return [0, 1, 2, 3, 4, 5, 6].map((day) =>
      format.format(new Date(A_SUNDAY + day * 86_400_000)),
    );
  }, [intl.locale]);

  if (parts.length === 0) return null;

  const hours = booking.hours ?? [];
  const slots = (booking.slots ?? []).filter(
    (at) => new Date(at).getTime() > Date.now(),
  );
  const zone = booking.time_zone;
  const ownZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <dl
      className='wachuneed-detail__terms wachuneed-booking-summary'
      aria-label={intl.formatMessage(messages.heading)}
    >
      {parts.includes('time') && booking.minutes ? (
        <>
          <dt>{intl.formatMessage(messages.length)}</dt>
          <dd>
            {intl.formatMessage(messages.minutes, { minutes: booking.minutes })}
          </dd>
        </>
      ) : null}

      {parts.includes('time') && hours.length > 0 ? (
        <>
          <dt>
            {zone && zone !== ownZone
              ? intl.formatMessage(messages.hoursZone, {
                  zone: zone.split('/').pop()?.replace(/_/g, ' '),
                })
              : intl.formatMessage(messages.hours)}
          </dt>
          <dd>
            {hours
              .map(
                (h) =>
                  `${dayNames[h.day]} ${clock(intl, h.from)}–${clock(intl, h.to)}`,
              )
              .join('\n')}
          </dd>
        </>
      ) : null}

      {parts.includes('time') && slots.length > 0 ? (
        <>
          <dt>{intl.formatMessage(messages.slots)}</dt>
          <dd>
            {slots
              .map((at) =>
                intl.formatDate(at, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  hour: 'numeric',
                  minute: '2-digit',
                }),
              )
              .join('\n')}
          </dd>
        </>
      ) : null}

      {parts.includes('time') && hours.length === 0 && slots.length === 0 ? (
        <>
          <dt>{intl.formatMessage(messages.when)}</dt>
          <dd>{intl.formatMessage(messages.suggest)}</dd>
        </>
      ) : null}

      {parts.includes('route') ? (
        <>
          <dt>{intl.formatMessage(messages.route)}</dt>
          <dd>{intl.formatMessage(messages.routeBody)}</dd>
        </>
      ) : null}

      {parts.includes('details') && booking.ask ? (
        <>
          <dt>{intl.formatMessage(messages.ask)}</dt>
          <dd>{booking.ask}</dd>
        </>
      ) : null}
    </dl>
  );
};
