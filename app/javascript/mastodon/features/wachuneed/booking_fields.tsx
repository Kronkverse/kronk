import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiGetListingTimes } from 'mastodon/api/wachuneed_requests';
import type {
  ApiRouteJSON,
  ApiRoutePointJSON,
} from 'mastodon/api/wachuneed_requests';
import type { ApiListingBookingJSON } from 'mastodon/api_types/wachuneed';
import {
  ComposeField,
  ComposeHint,
  ComposeInput,
  ComposeTextarea,
} from 'mastodon/components/compose_fields';
import { KornerPill } from 'mastodon/components/korner_pill';
import { MapPinPicker } from 'mastodon/components/map_pin_picker';
import type { PinnedLocation } from 'mastodon/components/map_pin_picker';
import { MapPinPreview } from 'mastodon/components/map_pin_preview';

// What a booked listing asks of the person booking it, on its page
// (docs/spaces/wachuneed.md, Booking): a time, from the seller's free times
// or one they suggest; a from and a to, each a pin on the Map; and what they
// need. Only the parts the listing has show. The from and the to go to the
// seller alone, with this booking.

export interface BookingValue {
  startsAt: string | null;
  route: ApiRouteJSON;
  details: string;
}

export const EMPTY_BOOKING_VALUE: BookingValue = {
  startsAt: null,
  route: {},
  details: '',
};

const messages = defineMessages({
  time: { id: 'wachuneed.book.time', defaultMessage: 'Pick a time' },
  suggest: {
    id: 'wachuneed.book.suggest',
    defaultMessage: 'When suits you',
  },
  suggestHint: {
    id: 'wachuneed.book.suggest_hint',
    defaultMessage: 'They say yes, or no.',
  },
  loading: { id: 'wachuneed.book.loading', defaultMessage: 'Finding times…' },
  noTimes: {
    id: 'wachuneed.book.no_times',
    defaultMessage: 'No free times in these two weeks.',
  },
  later: { id: 'wachuneed.book.later', defaultMessage: 'Later times' },
  from: { id: 'wachuneed.book.from', defaultMessage: 'From' },
  to: { id: 'wachuneed.book.to', defaultMessage: 'To' },
  pickFrom: { id: 'wachuneed.book.pick_from', defaultMessage: 'Pin the from' },
  pickTo: { id: 'wachuneed.book.pick_to', defaultMessage: 'Pin the to' },
  movePin: { id: 'wachuneed.book.move_pin', defaultMessage: 'Move it' },
  routeHint: {
    id: 'wachuneed.book.route_hint',
    defaultMessage: 'Only they see these, and only on this booking.',
  },
  details: {
    id: 'wachuneed.book.details',
    defaultMessage: 'What you need',
  },
});

// A datetime-local value in this browser's own time, from an ISO time, and
// back.
const pad = (n: number) => String(n).padStart(2, '0');
const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const TimePill: React.FC<{
  time: string;
  active: boolean;
  onPick: (time: string) => void;
}> = ({ time, active, onPick }) => {
  const intl = useIntl();
  const handleClick = useCallback(() => {
    onPick(time);
  }, [onPick, time]);

  return (
    <KornerPill
      label={intl.formatTime(time, { hour: 'numeric', minute: '2-digit' })}
      active={active}
      onClick={handleClick}
    />
  );
};

const TimeField: React.FC<{
  listingId: string;
  value: string | null;
  onChange: (time: string | null) => void;
}> = ({ listingId, value, onChange }) => {
  const intl = useIntl();
  const [suggest, setSuggest] = useState(false);
  const [times, setTimes] = useState<string[] | null>(null);
  const [from, setFrom] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    apiGetListingTimes(listingId, from)
      .then((result) => {
        if (!cancelled) {
          setSuggest(result.suggest);
          setTimes(result.times);
        }
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setTimes([]);
      });

    return () => {
      cancelled = true;
    };
  }, [listingId, from]);

  // The free times by day, in this reader's own time.
  const days = useMemo(() => {
    const byDay = new Map<string, string[]>();
    (times ?? []).forEach((time) => {
      const day = new Date(time).toDateString();
      byDay.set(day, [...(byDay.get(day) ?? []), time]);
    });
    return [...byDay.entries()];
  }, [times]);

  const handleSuggest = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      const d = new Date(e.currentTarget.value);
      onChange(Number.isNaN(d.getTime()) ? null : d.toISOString());
    },
    [onChange],
  );

  const handleLater = useCallback(() => {
    const last = times?.at(-1);
    // Two weeks on from the last of these; with none, from two weeks on.
    const next = last
      ? new Date(new Date(last).getTime() + 60_000)
      : new Date(new Date(from ?? Date.now()).getTime() + 14 * 86_400_000);
    setTimes(null);
    setFrom(next.toISOString());
  }, [from, times]);

  if (times === null) {
    return <ComposeHint>{intl.formatMessage(messages.loading)}</ComposeHint>;
  }

  if (suggest) {
    return (
      <ComposeField
        label={intl.formatMessage(messages.suggest)}
        hint={intl.formatMessage(messages.suggestHint)}
      >
        <ComposeInput
          type='datetime-local'
          value={toLocalInput(value)}
          onChange={handleSuggest}
        />
      </ComposeField>
    );
  }

  return (
    <div className='wachuneed-book__times'>
      <span className='compose-field__label'>
        {intl.formatMessage(messages.time)}
      </span>
      {days.length === 0 && (
        <ComposeHint>{intl.formatMessage(messages.noTimes)}</ComposeHint>
      )}
      {days.map(([day, dayTimes]) => (
        <div key={day} className='wachuneed-book__day'>
          <span className='wachuneed-book__day-name'>
            {intl.formatDate(dayTimes[0], {
              weekday: 'long',
              day: 'numeric',
              month: 'short',
            })}
          </span>
          <div className='wachuneed-book__day-times'>
            {dayTimes.map((time) => (
              <TimePill
                key={time}
                time={time}
                active={value === time}
                onPick={onChange}
              />
            ))}
          </div>
        </div>
      ))}
      <KornerPill
        label={intl.formatMessage(messages.later)}
        onClick={handleLater}
      />
    </div>
  );
};

const RouteEnd: React.FC<{
  end: 'from' | 'to';
  point: ApiRoutePointJSON | undefined;
  onChange: (end: 'from' | 'to', point: ApiRoutePointJSON) => void;
}> = ({ end, point, onChange }) => {
  const intl = useIntl();
  const [picking, setPicking] = useState(false);

  const open = useCallback(() => {
    setPicking(true);
  }, []);
  const close = useCallback(() => {
    setPicking(false);
  }, []);
  const handlePin = useCallback(
    (pin: PinnedLocation) => {
      onChange(end, { lat: pin.lat, lng: pin.lng, name: pin.label });
      setPicking(false);
    },
    [end, onChange],
  );

  return (
    <div className='wachuneed-book__end'>
      <span className='compose-field__label'>
        {intl.formatMessage(end === 'from' ? messages.from : messages.to)}
      </span>
      {point && (
        <>
          {point.name && (
            <span className='wachuneed-book__end-name'>{point.name}</span>
          )}
          <MapPinPreview
            lng={point.lng}
            lat={point.lat}
            zoom={14}
            className='wachuneed-book__preview'
          />
        </>
      )}
      <KornerPill
        label={intl.formatMessage(
          point
            ? messages.movePin
            : end === 'from'
              ? messages.pickFrom
              : messages.pickTo,
        )}
        onClick={open}
      />
      {picking && (
        <MapPinPicker
          initial={point ? { ...point, zoom: 14 } : undefined}
          onCancel={close}
          onPin={handlePin}
        />
      )}
    </div>
  );
};

export const BookingFields: React.FC<{
  listingId: string;
  booking: ApiListingBookingJSON;
  value: BookingValue;
  onChange: (value: BookingValue) => void;
}> = ({ listingId, booking, value, onChange }) => {
  const intl = useIntl();
  const parts = booking.parts ?? [];

  const handleTime = useCallback(
    (startsAt: string | null) => {
      onChange({ ...value, startsAt });
    },
    [onChange, value],
  );

  const handleEnd = useCallback(
    (end: 'from' | 'to', point: ApiRoutePointJSON) => {
      onChange({ ...value, route: { ...value.route, [end]: point } });
    },
    [onChange, value],
  );

  const handleDetails = useCallback<
    React.ChangeEventHandler<HTMLTextAreaElement>
  >(
    (e) => {
      onChange({ ...value, details: e.currentTarget.value });
    },
    [onChange, value],
  );

  return (
    <div className='wachuneed-book'>
      {parts.includes('time') && (
        <TimeField
          listingId={listingId}
          value={value.startsAt}
          onChange={handleTime}
        />
      )}

      {parts.includes('route') && (
        <div className='wachuneed-book__route'>
          <RouteEnd end='from' point={value.route.from} onChange={handleEnd} />
          <RouteEnd end='to' point={value.route.to} onChange={handleEnd} />
          <ComposeHint>{intl.formatMessage(messages.routeHint)}</ComposeHint>
        </div>
      )}

      {parts.includes('details') && (
        <ComposeField
          label={booking.ask ?? intl.formatMessage(messages.details)}
        >
          <ComposeTextarea
            value={value.details}
            onChange={handleDetails}
            maxLength={1000}
          />
        </ComposeField>
      )}
    </div>
  );
};

// Whether everything the listing's parts ask for is given.
export const bookingComplete = (
  booking: ApiListingBookingJSON,
  value: BookingValue,
) => {
  const parts = booking.parts ?? [];
  return (
    (!parts.includes('time') || !!value.startsAt) &&
    (!parts.includes('route') || (!!value.route.from && !!value.route.to)) &&
    (!parts.includes('details') || value.details.trim().length > 0)
  );
};
