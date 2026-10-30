import { useCallback, useMemo, useRef } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';
import type { IntlShape, MessageDescriptor } from 'react-intl';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import type {
  ApiListingBookingJSON,
  ListingBookingPart,
  ListingBookingTemplate,
} from 'mastodon/api_types/wachuneed';
import {
  ComposeCheck,
  ComposeField,
  ComposeHint,
  ComposeInput,
  ComposeRow,
  ComposeSection,
  ComposeSelect,
} from 'mastodon/components/compose_fields';
import { Icon } from 'mastodon/components/icon';
import { KornerPill } from 'mastodon/components/korner_pill';

// The Booking part of the listing form (docs/spaces/wachuneed.md, Booking;
// Kommons "Goods & Services", Tal 2026-10-29: "add a whole bunch of
// different aspects to the listing, or choose generic ones like
// 'Appointment style' … with the ability to add, remove and edit the
// options each template has").
//
// A listing is built from parts, each something the person booking gives:
// a time, a from and a to on the Map, their details. The templates
// (Appointment, Job, Open request) only fill the parts in to start from;
// the seller keeps, drops or changes any of it. When there is a time, the
// seller says when they are free: weekly hours, times they post, or both;
// with neither, people suggest a time.

const MAX_HOURS = 21;
const MAX_SLOTS = 60;
const PARTS: ListingBookingPart[] = ['time', 'route', 'details'];
const LENGTHS = [15, 30, 45, 60, 90, 120, 180, 240, 480];
// 2026-11-01 was a Sunday: day 0, as the server counts them.
const A_SUNDAY = Date.UTC(2026, 10, 1);

export interface HoursRow {
  key: string;
  day: string;
  from: string;
  to: string;
}

export interface SlotRow {
  key: string;
  // As a datetime-local input holds it, in the seller's own time.
  at: string;
}

export interface BookingState {
  template: ListingBookingTemplate | null;
  parts: ListingBookingPart[];
  minutes: string;
  hours: HoursRow[];
  slots: SlotRow[];
  ask: string;
}

export const EMPTY_BOOKING: BookingState = {
  template: null,
  parts: [],
  minutes: '',
  hours: [],
  slots: [],
  ask: '',
};

const messages = defineMessages({
  heading: {
    id: 'wachuneed.booking.heading',
    defaultMessage: 'How people book it',
  },
  hint: {
    id: 'wachuneed.booking.hint',
    defaultMessage:
      'Start from one of these, then add, drop or change anything in it.',
  },
  none: { id: 'wachuneed.booking.none', defaultMessage: 'Ask for this' },
  appointment: {
    id: 'wachuneed.booking.template.appointment',
    defaultMessage: 'Appointment',
  },
  job: { id: 'wachuneed.booking.template.job', defaultMessage: 'Job' },
  request: {
    id: 'wachuneed.booking.template.request',
    defaultMessage: 'Open request',
  },
  partTime: { id: 'wachuneed.booking.part.time', defaultMessage: 'A time' },
  partTimeHint: {
    id: 'wachuneed.booking.part.time_hint',
    defaultMessage: 'They pick when, from the times you are free.',
  },
  partRoute: {
    id: 'wachuneed.booking.part.route',
    defaultMessage: 'From and to',
  },
  partRouteHint: {
    id: 'wachuneed.booking.part.route_hint',
    defaultMessage: 'Two places on the Map, for a trip or a job.',
  },
  partDetails: {
    id: 'wachuneed.booking.part.details',
    defaultMessage: 'Their details',
  },
  partDetailsHint: {
    id: 'wachuneed.booking.part.details_hint',
    defaultMessage: 'What they need, in their own words.',
  },
  length: { id: 'wachuneed.booking.length', defaultMessage: 'How long' },
  lengthNone: {
    id: 'wachuneed.booking.length.none',
    defaultMessage: 'No set length',
  },
  lengthMinutes: {
    id: 'wachuneed.booking.length.minutes',
    defaultMessage: '{minutes} minutes',
  },
  lengthHours: {
    id: 'wachuneed.booking.length.hours',
    defaultMessage: '{hours, plural, one {# hour} other {# hours}}',
  },
  hours: { id: 'wachuneed.booking.hours', defaultMessage: 'Weekly hours' },
  day: { id: 'wachuneed.booking.day', defaultMessage: 'Day' },
  from: { id: 'wachuneed.booking.from', defaultMessage: 'From' },
  to: { id: 'wachuneed.booking.to', defaultMessage: 'To' },
  addHours: { id: 'wachuneed.booking.add_hours', defaultMessage: 'Add hours' },
  removeHours: {
    id: 'wachuneed.booking.remove_hours',
    defaultMessage: 'Remove these hours',
  },
  slots: { id: 'wachuneed.booking.slots', defaultMessage: 'Times you post' },
  slot: { id: 'wachuneed.booking.slot', defaultMessage: 'A time you post' },
  addSlot: { id: 'wachuneed.booking.add_slot', defaultMessage: 'Add a time' },
  removeSlot: {
    id: 'wachuneed.booking.remove_slot',
    defaultMessage: 'Remove this time',
  },
  suggest: {
    id: 'wachuneed.booking.suggest',
    defaultMessage:
      'With no hours or times here, people suggest a time and you say yes or no.',
  },
  ask: { id: 'wachuneed.booking.ask', defaultMessage: 'What to ask them' },
  askJob: {
    id: 'wachuneed.booking.ask.job',
    defaultMessage: 'What needs doing?',
  },
  askRequest: {
    id: 'wachuneed.booking.ask.request',
    defaultMessage: 'Tell me what you need, and when suits you.',
  },
});

const TEMPLATES: {
  id: ListingBookingTemplate;
  label: MessageDescriptor;
}[] = [
  { id: 'appointment', label: messages.appointment },
  { id: 'job', label: messages.job },
  { id: 'request', label: messages.request },
];

const PART_LABELS: Record<
  ListingBookingPart,
  { label: MessageDescriptor; hint: MessageDescriptor }
> = {
  time: { label: messages.partTime, hint: messages.partTimeHint },
  route: { label: messages.partRoute, hint: messages.partRouteHint },
  details: { label: messages.partDetails, hint: messages.partDetailsHint },
};

let rowCount = 0;
const rowKey = () => {
  rowCount += 1;
  return `booking-${rowCount}`;
};

const pad = (n: number) => String(n).padStart(2, '0');

// An ISO time from the server as a datetime-local value in this browser's
// own time, and back.
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fromLocalInput = (value: string) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export const bookingStateFrom = (
  json: ApiListingBookingJSON | undefined,
): BookingState => {
  if (!json?.parts?.length) return EMPTY_BOOKING;

  return {
    template: json.template ?? null,
    parts: json.parts,
    minutes: json.minutes ? String(json.minutes) : '',
    hours: (json.hours ?? []).map((h) => ({
      key: rowKey(),
      day: String(h.day),
      from: h.from,
      to: h.to,
    })),
    slots: (json.slots ?? []).map((at) => ({
      key: rowKey(),
      at: toLocalInput(at),
    })),
    ask: json.ask ?? '',
  };
};

// What the server keeps. The seller's own time zone goes with the hours,
// so they mean the same thing to someone booking from elsewhere.
export const bookingStateToPayload = (
  state: BookingState,
): ApiListingBookingJSON => {
  if (state.parts.length === 0) return {};

  return {
    parts: state.parts,
    template: state.template ?? undefined,
    minutes: state.minutes ? Number(state.minutes) : undefined,
    hours: state.hours
      .filter((h) => h.from && h.to)
      .map((h) => ({ day: Number(h.day), from: h.from, to: h.to })),
    slots: state.slots
      .map((s) => fromLocalInput(s.at))
      .filter((at): at is string => at !== null),
    time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    ask: state.ask.trim() || undefined,
  };
};

// Where each template starts. Weekdays nine to five for an appointment,
// so it is bookable as it stands.
const fromTemplate = (
  template: ListingBookingTemplate,
  intl: IntlShape,
): BookingState => {
  switch (template) {
    case 'appointment':
      return {
        ...EMPTY_BOOKING,
        template,
        parts: ['time'],
        minutes: '60',
        hours: [1, 2, 3, 4, 5].map((day) => ({
          key: rowKey(),
          day: String(day),
          from: '09:00',
          to: '17:00',
        })),
      };
    case 'job':
      return {
        ...EMPTY_BOOKING,
        template,
        parts: ['time', 'route', 'details'],
        ask: intl.formatMessage(messages.askJob),
      };
    case 'request':
      return {
        ...EMPTY_BOOKING,
        template,
        parts: ['time', 'details'],
        ask: intl.formatMessage(messages.askRequest),
      };
  }
};

const TemplatePill: React.FC<{
  template: ListingBookingTemplate | null;
  label: MessageDescriptor;
  active: boolean;
  onPick: (template: ListingBookingTemplate | null) => void;
}> = ({ template, label, active, onPick }) => {
  const intl = useIntl();
  const handleClick = useCallback(() => {
    onPick(template);
  }, [onPick, template]);

  return (
    <KornerPill
      label={intl.formatMessage(label)}
      active={active}
      onClick={handleClick}
    />
  );
};

export const ListingBookingEditor: React.FC<{
  state: BookingState;
  onChange: (state: BookingState) => void;
}> = ({ state, onChange }) => {
  const intl = useIntl();
  const latest = useRef(state);
  latest.current = state;

  const set = useCallback(
    (patch: Partial<BookingState>) => {
      onChange({ ...latest.current, ...patch });
    },
    [onChange],
  );

  const dayNames = useMemo(() => {
    const format = new Intl.DateTimeFormat(intl.locale, {
      weekday: 'long',
      timeZone: 'UTC',
    });
    return [0, 1, 2, 3, 4, 5, 6].map((day) =>
      format.format(new Date(A_SUNDAY + day * 86_400_000)),
    );
  }, [intl.locale]);

  const handlePick = useCallback(
    (template: ListingBookingTemplate | null) => {
      onChange(template ? fromTemplate(template, intl) : EMPTY_BOOKING);
    },
    [intl, onChange],
  );

  const handlePart = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      const part = e.currentTarget.value as ListingBookingPart;
      const { checked } = e.currentTarget;
      const kept = latest.current.parts.filter((p) => p !== part);
      set({
        parts: PARTS.filter((p) => kept.includes(p) || (checked && p === part)),
      });
    },
    [set],
  );

  const handleMinutes = useCallback<
    React.ChangeEventHandler<HTMLSelectElement>
  >(
    (e) => {
      set({ minutes: e.currentTarget.value });
    },
    [set],
  );

  const handleAsk = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      set({ ask: e.currentTarget.value });
    },
    [set],
  );

  const handleHoursAdd = useCallback(() => {
    const last = latest.current.hours.at(-1);
    set({
      hours: [
        ...latest.current.hours,
        {
          key: rowKey(),
          day: last ? String((Number(last.day) + 1) % 7) : '1',
          from: last?.from ?? '09:00',
          to: last?.to ?? '17:00',
        },
      ],
    });
  }, [set]);

  const handleHours = useCallback<
    React.ChangeEventHandler<HTMLInputElement | HTMLSelectElement>
  >(
    (e) => {
      const { row, field } = e.currentTarget.dataset;
      const { value } = e.currentTarget;
      set({
        hours: latest.current.hours.map((h) =>
          h.key === row ? { ...h, [field ?? 'day']: value } : h,
        ),
      });
    },
    [set],
  );

  const handleHoursRemove = useCallback<
    React.MouseEventHandler<HTMLButtonElement>
  >(
    (e) => {
      const { row } = e.currentTarget.dataset;
      set({ hours: latest.current.hours.filter((h) => h.key !== row) });
    },
    [set],
  );

  const handleSlotAdd = useCallback(() => {
    set({ slots: [...latest.current.slots, { key: rowKey(), at: '' }] });
  }, [set]);

  const handleSlot = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      const { row } = e.currentTarget.dataset;
      const { value } = e.currentTarget;
      set({
        slots: latest.current.slots.map((s) =>
          s.key === row ? { ...s, at: value } : s,
        ),
      });
    },
    [set],
  );

  const handleSlotRemove = useCallback<
    React.MouseEventHandler<HTMLButtonElement>
  >(
    (e) => {
      const { row } = e.currentTarget.dataset;
      set({ slots: latest.current.slots.filter((s) => s.key !== row) });
    },
    [set],
  );

  const booked = state.parts.length > 0;
  const hasTime = state.parts.includes('time');

  return (
    <ComposeSection
      title={<FormattedMessage {...messages.heading} />}
      className='wachuneed-booking-edit'
    >
      <ComposeHint>
        <FormattedMessage {...messages.hint} />
      </ComposeHint>

      <div className='wachuneed-booking-edit__templates'>
        <TemplatePill
          template={null}
          label={messages.none}
          active={!booked}
          onPick={handlePick}
        />
        {TEMPLATES.map((t) => (
          <TemplatePill
            key={t.id}
            template={t.id}
            label={t.label}
            active={booked && state.template === t.id}
            onPick={handlePick}
          />
        ))}
      </div>

      {booked &&
        PARTS.map((part) => (
          <ComposeCheck
            key={part}
            value={part}
            label={<FormattedMessage {...PART_LABELS[part].label} />}
            hint={<FormattedMessage {...PART_LABELS[part].hint} />}
            checked={state.parts.includes(part)}
            onChange={handlePart}
          />
        ))}

      {hasTime && (
        <>
          <ComposeField label={<FormattedMessage {...messages.length} />}>
            <ComposeSelect value={state.minutes} onChange={handleMinutes}>
              <option value=''>
                {intl.formatMessage(messages.lengthNone)}
              </option>
              {LENGTHS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes < 60 || minutes % 60 !== 0
                    ? intl.formatMessage(messages.lengthMinutes, { minutes })
                    : intl.formatMessage(messages.lengthHours, {
                        hours: minutes / 60,
                      })}
                </option>
              ))}
            </ComposeSelect>
          </ComposeField>

          <div className='wachuneed-booking-edit__group'>
            <span className='compose-field__label'>
              <FormattedMessage {...messages.hours} />
            </span>
            {state.hours.map((h) => (
              <ComposeRow key={h.key} className='wachuneed-booking-edit__row'>
                <ComposeSelect
                  value={h.day}
                  data-row={h.key}
                  data-field='day'
                  onChange={handleHours}
                  aria-label={intl.formatMessage(messages.day)}
                >
                  {dayNames.map((name, day) => (
                    <option key={name} value={day}>
                      {name}
                    </option>
                  ))}
                </ComposeSelect>
                <ComposeInput
                  type='time'
                  value={h.from}
                  data-row={h.key}
                  data-field='from'
                  onChange={handleHours}
                  aria-label={intl.formatMessage(messages.from)}
                />
                <ComposeInput
                  type='time'
                  value={h.to}
                  data-row={h.key}
                  data-field='to'
                  onChange={handleHours}
                  aria-label={intl.formatMessage(messages.to)}
                />
                <button
                  type='button'
                  className='wachuneed-options-edit__icon'
                  data-row={h.key}
                  onClick={handleHoursRemove}
                  aria-label={intl.formatMessage(messages.removeHours)}
                  title={intl.formatMessage(messages.removeHours)}
                >
                  <Icon id='close' icon={CloseIcon} />
                </button>
              </ComposeRow>
            ))}
            {state.hours.length < MAX_HOURS && (
              <button
                type='button'
                className='wachuneed-options-edit__add'
                onClick={handleHoursAdd}
              >
                <FormattedMessage {...messages.addHours} />
              </button>
            )}
          </div>

          <div className='wachuneed-booking-edit__group'>
            <span className='compose-field__label'>
              <FormattedMessage {...messages.slots} />
            </span>
            {state.slots.map((s) => (
              <ComposeRow key={s.key} className='wachuneed-booking-edit__row'>
                <ComposeInput
                  type='datetime-local'
                  value={s.at}
                  data-row={s.key}
                  onChange={handleSlot}
                  aria-label={intl.formatMessage(messages.slot)}
                />
                <button
                  type='button'
                  className='wachuneed-options-edit__icon'
                  data-row={s.key}
                  onClick={handleSlotRemove}
                  aria-label={intl.formatMessage(messages.removeSlot)}
                  title={intl.formatMessage(messages.removeSlot)}
                >
                  <Icon id='close' icon={CloseIcon} />
                </button>
              </ComposeRow>
            ))}
            {state.slots.length < MAX_SLOTS && (
              <button
                type='button'
                className='wachuneed-options-edit__add'
                onClick={handleSlotAdd}
              >
                <FormattedMessage {...messages.addSlot} />
              </button>
            )}
          </div>

          {state.hours.length === 0 && state.slots.length === 0 && (
            <ComposeHint>
              <FormattedMessage {...messages.suggest} />
            </ComposeHint>
          )}
        </>
      )}

      {state.parts.includes('details') && (
        <ComposeField label={<FormattedMessage {...messages.ask} />}>
          <ComposeInput
            value={state.ask}
            onChange={handleAsk}
            maxLength={120}
          />
        </ComposeField>
      )}
    </ComposeSection>
  );
};
