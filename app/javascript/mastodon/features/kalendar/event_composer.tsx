import { useCallback, useMemo, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import api from 'mastodon/api';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { ReachDropdown } from 'mastodon/components/reach_dropdown';
import type { ReachValue } from 'mastodon/components/reach_dropdown';

// Kalendar — event composer. First implementation, mounted directly
// against the shared `<ComposeShell>` standard rather than a bespoke
// page (per docs/rebuild/decisions.md 2026-08-12: "Kalendar /
// Martketplace / Huddle — declare `compose.route` in the manifest but
// no shell-shaped composer yet. Do first-implementation against this
// decision rather than shipping a bespoke one").
//
// Fields mirror the `event_params` permit list in
// `Api::V1::EventsController#event_params` — title, description, start /
// end time, location name + url, event_type (event | huddle), rsvp_enabled.
// `visibility` sits alongside (not in event_params) — the controller
// reads it to seed the accompanying Status via PostStatusService. Reach
// lives in the shell's `headerAction` slot, the same treatment Moments
// + trek composer use.

const messages = defineMessages({
  label: { id: 'kalendar.new.title', defaultMessage: 'New event' },
  subtitle: {
    id: 'kalendar.new.subtitle',
    defaultMessage: 'A shared time for the people you invite.',
  },
  eventTitle: { id: 'kalendar.new.event_title', defaultMessage: 'Title' },
  eventTitlePlaceholder: {
    id: 'kalendar.new.event_title_placeholder',
    defaultMessage: 'What is happening?',
  },
  description: {
    id: 'kalendar.new.description',
    defaultMessage: 'Description',
  },
  descriptionPlaceholder: {
    id: 'kalendar.new.description_placeholder',
    defaultMessage: 'What people should know before they show up.',
  },
  when: { id: 'kalendar.new.when', defaultMessage: 'When' },
  starts: { id: 'kalendar.new.starts', defaultMessage: 'Starts' },
  ends: { id: 'kalendar.new.ends', defaultMessage: 'Ends (optional)' },
  where: { id: 'kalendar.new.where', defaultMessage: 'Where' },
  locationName: {
    id: 'kalendar.new.location_name',
    defaultMessage: 'Location',
  },
  locationNamePlaceholder: {
    id: 'kalendar.new.location_name_placeholder',
    defaultMessage: 'A pub, a park, an address.',
  },
  locationUrl: {
    id: 'kalendar.new.location_url',
    defaultMessage: 'Location link (optional)',
  },
  locationUrlPlaceholder: {
    id: 'kalendar.new.location_url_placeholder',
    defaultMessage: 'https://…',
  },
  type: { id: 'kalendar.new.type', defaultMessage: 'Kind' },
  typeEvent: { id: 'kalendar.new.type_event', defaultMessage: 'In-person' },
  typeHuddle: {
    id: 'kalendar.new.type_huddle',
    defaultMessage: 'Huddle (online)',
  },
  rsvpEnabled: {
    id: 'kalendar.new.rsvp_enabled',
    defaultMessage: 'Let people RSVP',
  },
  create: { id: 'kalendar.new.create', defaultMessage: 'Post it' },
  creating: { id: 'kalendar.new.creating', defaultMessage: 'Posting…' },
});

type EventType = 'event' | 'huddle';

// The server returns the full event record; we only need the id here so
// the caller can navigate to `/hub/kalendar/<id>`.
export interface CreatedEvent {
  id: string;
}

interface CreatePayload {
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  location_name?: string;
  location_url?: string;
  event_type: EventType;
  rsvp_enabled: boolean;
  visibility: ReachValue;
}

// Combine a date input ("YYYY-MM-DD") + time input ("HH:MM") into an
// ISO string in the browser's local zone. Returns null when either
// half is missing so callers can skip the field.
const combineLocal = (date: string, time: string): string | null => {
  if (!date || !time) return null;
  const parsed = new Date(`${date}T${time}`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

interface Props {
  onCancel: () => void;
  onCreated: (event: CreatedEvent) => void;
}

export const EventComposer: React.FC<Props> = ({ onCancel, onCreated }) => {
  const intl = useIntl();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationUrl, setLocationUrl] = useState('');
  const [eventType, setEventType] = useState<EventType>('event');
  const [rsvpEnabled, setRsvpEnabled] = useState(true);
  // Default to public: events are "shared time" (Kalendar manifest
  // purpose) and the manifest ships `default_event_visibility: public`.
  // Self-only is hidden — an event only you can see isn't an event.
  const [reach, setReach] = useState<ReachValue>('public');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startIso = useMemo(
    () => combineLocal(startDate, startTime),
    [startDate, startTime],
  );
  const endIso = useMemo(
    () => combineLocal(endDate, endTime),
    [endDate, endTime],
  );

  const canSubmit = title.trim().length > 0 && startIso !== null && !busy;

  const onTitle = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setTitle(e.target.value);
    },
    [],
  );
  const onDescription = useCallback<
    React.ChangeEventHandler<HTMLTextAreaElement>
  >((e) => {
    setDescription(e.target.value);
  }, []);
  const onStartDate = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setStartDate(e.target.value);
    },
    [],
  );
  const onStartTime = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setStartTime(e.target.value);
    },
    [],
  );
  const onEndDate = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setEndDate(e.target.value);
    },
    [],
  );
  const onEndTime = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setEndTime(e.target.value);
    },
    [],
  );
  const onLocationName = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setLocationName(e.target.value);
  }, []);
  const onLocationUrl = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setLocationUrl(e.target.value);
    },
    [],
  );
  const onEventType = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setEventType(e.currentTarget.value as EventType);
    },
    [],
  );
  const onRsvpToggle = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setRsvpEnabled(e.currentTarget.checked);
    },
    [],
  );
  const onReach = useCallback((value: ReachValue) => {
    setReach(value);
  }, []);

  const submit = useCallback(() => {
    if (!startIso) return;
    setError(null);
    setBusy(true);
    const payload: CreatePayload = {
      title: title.trim(),
      start_time: startIso,
      event_type: eventType,
      rsvp_enabled: rsvpEnabled,
      visibility: reach,
    };
    const trimmedDescription = description.trim();
    if (trimmedDescription) payload.description = trimmedDescription;
    if (endIso) payload.end_time = endIso;
    const trimmedLocationName = locationName.trim();
    if (trimmedLocationName) payload.location_name = trimmedLocationName;
    const trimmedLocationUrl = locationUrl.trim();
    if (trimmedLocationUrl) payload.location_url = trimmedLocationUrl;

    void (async () => {
      try {
        const res = await api().post<CreatedEvent>('/api/v1/events', payload);
        onCreated(res.data);
        // Parent unmounts on success — no need to reset state.
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
        setBusy(false);
      }
    })();
  }, [
    description,
    endIso,
    eventType,
    locationName,
    locationUrl,
    onCreated,
    reach,
    rsvpEnabled,
    startIso,
    title,
  ]);

  const reachControl = (
    <ReachDropdown
      value={reach}
      onChange={onReach}
      disabled={busy}
      hide={['self_only']}
    />
  );

  return (
    <ComposeShell
      korner='kalendar'
      label={intl.formatMessage(messages.label)}
      subtitle={intl.formatMessage(messages.subtitle)}
      submitLabel={intl.formatMessage(messages.create)}
      submittingLabel={intl.formatMessage(messages.creating)}
      submitting={busy}
      canSubmit={canSubmit}
      onSubmit={submit}
      onCancel={onCancel}
      headerAction={reachControl}
    >
      <div className='event-composer'>
        <label className='event-composer__field'>
          <span className='event-composer__field-label'>
            {intl.formatMessage(messages.eventTitle)}
          </span>
          <input
            type='text'
            value={title}
            onChange={onTitle}
            placeholder={intl.formatMessage(messages.eventTitlePlaceholder)}
            required
            className='event-composer__input'
          />
        </label>

        <label className='event-composer__field'>
          <span className='event-composer__field-label'>
            {intl.formatMessage(messages.description)}
          </span>
          <textarea
            value={description}
            onChange={onDescription}
            placeholder={intl.formatMessage(messages.descriptionPlaceholder)}
            rows={3}
            className='event-composer__input'
          />
        </label>

        <fieldset className='event-composer__fieldset'>
          <legend className='event-composer__legend'>
            {intl.formatMessage(messages.when)}
          </legend>
          <div className='event-composer__row'>
            <label className='event-composer__field event-composer__field--half'>
              <span className='event-composer__field-label'>
                {intl.formatMessage(messages.starts)}
              </span>
              <div className='event-composer__datetime'>
                <input
                  type='date'
                  value={startDate}
                  onChange={onStartDate}
                  required
                  className='event-composer__input'
                />
                <input
                  type='time'
                  value={startTime}
                  onChange={onStartTime}
                  required
                  className='event-composer__input'
                />
              </div>
            </label>
            <label className='event-composer__field event-composer__field--half'>
              <span className='event-composer__field-label'>
                {intl.formatMessage(messages.ends)}
              </span>
              <div className='event-composer__datetime'>
                <input
                  type='date'
                  value={endDate}
                  onChange={onEndDate}
                  className='event-composer__input'
                />
                <input
                  type='time'
                  value={endTime}
                  onChange={onEndTime}
                  className='event-composer__input'
                />
              </div>
            </label>
          </div>
        </fieldset>

        <fieldset className='event-composer__fieldset'>
          <legend className='event-composer__legend'>
            {intl.formatMessage(messages.type)}
          </legend>
          <div className='event-composer__radio-row'>
            <label className='event-composer__radio'>
              <input
                type='radio'
                name='event-type'
                value='event'
                checked={eventType === 'event'}
                onChange={onEventType}
              />
              <span>{intl.formatMessage(messages.typeEvent)}</span>
            </label>
            <label className='event-composer__radio'>
              <input
                type='radio'
                name='event-type'
                value='huddle'
                checked={eventType === 'huddle'}
                onChange={onEventType}
              />
              <span>{intl.formatMessage(messages.typeHuddle)}</span>
            </label>
          </div>
        </fieldset>

        {eventType === 'event' && (
          <fieldset className='event-composer__fieldset'>
            <legend className='event-composer__legend'>
              {intl.formatMessage(messages.where)}
            </legend>
            <label className='event-composer__field'>
              <span className='event-composer__field-label'>
                {intl.formatMessage(messages.locationName)}
              </span>
              <input
                type='text'
                value={locationName}
                onChange={onLocationName}
                placeholder={intl.formatMessage(
                  messages.locationNamePlaceholder,
                )}
                className='event-composer__input'
              />
            </label>
            <label className='event-composer__field'>
              <span className='event-composer__field-label'>
                {intl.formatMessage(messages.locationUrl)}
              </span>
              <input
                type='url'
                value={locationUrl}
                onChange={onLocationUrl}
                placeholder={intl.formatMessage(
                  messages.locationUrlPlaceholder,
                )}
                className='event-composer__input'
              />
            </label>
          </fieldset>
        )}

        <label className='event-composer__checkbox'>
          <input
            type='checkbox'
            checked={rsvpEnabled}
            onChange={onRsvpToggle}
          />
          <span>{intl.formatMessage(messages.rsvpEnabled)}</span>
        </label>

        {error && (
          <p className='event-composer__error' role='alert'>
            <FormattedMessage
              id='kalendar.new.error'
              defaultMessage="Couldn't create the event: {error}"
              values={{ error }}
            />
          </p>
        )}
      </div>
    </ComposeShell>
  );
};
