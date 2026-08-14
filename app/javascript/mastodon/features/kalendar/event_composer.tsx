import { useCallback, useMemo, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import axios from 'axios';

import api from 'mastodon/api';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { MapPinPicker } from 'mastodon/components/map_pin_picker';
import type { PinnedLocation } from 'mastodon/components/map_pin_picker';
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
  address: {
    id: 'kalendar.new.address',
    defaultMessage: 'Address',
  },
  addressPlaceholder: {
    id: 'kalendar.new.address_placeholder',
    defaultMessage:
      "A pub, a park, an address — write however you'd text a friend.",
  },
  mapLink: {
    id: 'kalendar.new.map_link',
    defaultMessage: 'Map link (optional)',
  },
  mapLinkHint: {
    id: 'kalendar.new.map_link_hint',
    defaultMessage:
      'A map link people can open in any browser — type one, or use Pin on map below.',
  },
  mapLinkPlaceholder: {
    id: 'kalendar.new.map_link_placeholder',
    defaultMessage: 'https://…',
  },
  startDate: { id: 'kalendar.new.start_date', defaultMessage: 'Date' },
  startTime: { id: 'kalendar.new.start_time', defaultMessage: 'Time' },
  endDate: { id: 'kalendar.new.end_date', defaultMessage: 'End date' },
  endTime: { id: 'kalendar.new.end_time', defaultMessage: 'End time' },
  pinOnMap: {
    id: 'kalendar.new.pin_on_map',
    defaultMessage: 'Pin on map',
  },
  pinnedAt: {
    id: 'kalendar.new.pinned_at',
    defaultMessage: 'Pinned at {lat}, {lng}',
  },
  clearPin: {
    id: 'kalendar.new.clear_pin',
    defaultMessage: 'Clear pin',
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
  needTitleAndStart: {
    id: 'kalendar.new.need_title_and_start',
    defaultMessage: 'Add a title and pick a start date + time to post.',
  },
  needTitle: {
    id: 'kalendar.new.need_title',
    defaultMessage: 'Add a title to post.',
  },
  needStart: {
    id: 'kalendar.new.need_start',
    defaultMessage: 'Pick a start date + time to post.',
  },
  cover: {
    id: 'kalendar.new.cover',
    defaultMessage: 'Cover image (optional)',
  },
  addCover: {
    id: 'kalendar.new.add_cover',
    defaultMessage: 'Choose an image',
  },
  uploadingCover: {
    id: 'kalendar.new.uploading_cover',
    defaultMessage: 'Uploading…',
  },
  removeCover: {
    id: 'kalendar.new.remove_cover',
    defaultMessage: 'Remove image',
  },
  coverUploadFailed: {
    id: 'kalendar.new.cover_upload_failed',
    defaultMessage: "Couldn't upload the image: {error}",
  },
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
  image_id?: string;
}

// Shape returned by POST /api/v2/media. Only the ID is required to
// attach the media to a Status/Event; the preview_url is used inline
// for the in-composer thumbnail so the user sees exactly what they
// just uploaded.
interface MediaResponse {
  id: string;
  preview_url?: string | null;
  url?: string | null;
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

// Format a JS Date as the browser's local `<input type="date">` value.
const dateInputValue = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const timeInputValue = (d: Date): string => {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

// Round `d` up to the next SNAP-minute boundary — so 14:23 → 14:25 with
// a 5-min snap. Matches the `<input type="time" step>` snap Tal asked
// for (2026-08-14) so the auto-filled default sits on the same grid
// the picker offers.
const SNAP_MINUTES = 5;
const roundUpToSnap = (d: Date): Date => {
  const out = new Date(d);
  const mins = out.getMinutes();
  const remainder = mins % SNAP_MINUTES;
  if (remainder !== 0 || out.getSeconds() > 0 || out.getMilliseconds() > 0) {
    out.setMinutes(mins + (SNAP_MINUTES - remainder));
  }
  out.setSeconds(0, 0);
  return out;
};

// Default start = now, rounded up to the next 5-min slot.
// Default end   = start + 2 hours.
// Both split into their date + time inputs so the user can tweak either
// half without recomputing the other. Computed once at mount via lazy
// useState so refreshing the composer doesn't drift the defaults every
// render.
interface DefaultTimes {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}
const computeDefaultTimes = (): DefaultTimes => {
  const start = roundUpToSnap(new Date());
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  return {
    startDate: dateInputValue(start),
    startTime: timeInputValue(start),
    endDate: dateInputValue(end),
    endTime: timeInputValue(end),
  };
};

// Pull a useful message out of an axios error. Rails returns 4xx
// bodies in one of a few shapes — `{ error: "…" }` (single message),
// `{ errors: { field: [msg, …], … } }` (ActiveRecord validation),
// or `{ error: { … } }` (nested). Falls back to axios's default
// message so we always show *something* helpful instead of the
// generic "Request failed with status code 422" that hides the
// actual field problem (Tal 2026-08-14: hit Post it, saw only
// that generic string).
const extractApiError = (e: unknown): string => {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as
      | { error?: string | Record<string, unknown>; errors?: unknown }
      | undefined;
    if (data && typeof data.error === 'string') return data.error;
    if (data?.errors && typeof data.errors === 'object') {
      const entries = Object.entries(data.errors as Record<string, unknown>);
      const parts = entries.map(([field, msgs]) => {
        const list = Array.isArray(msgs) ? msgs.join(', ') : String(msgs);
        return `${field}: ${list}`;
      });
      if (parts.length > 0) return parts.join('; ');
    }
    return e.message;
  }
  return e instanceof Error ? e.message : String(e);
};

interface Props {
  onCancel: () => void;
  onCreated: (event: CreatedEvent) => void;
}

export const EventComposer: React.FC<Props> = ({ onCancel, onCreated }) => {
  const intl = useIntl();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  // Auto-fill start = now (rounded to next 5-min slot), end = +2h —
  // Tal 2026-08-14. Lazy initialiser so `new Date()` runs once at
  // mount; the user can still tweak either half.
  const defaults = useMemo(() => computeDefaultTimes(), []);
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [startTime, setStartTime] = useState(defaults.startTime);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [endTime, setEndTime] = useState(defaults.endTime);
  const [locationName, setLocationName] = useState('');
  const [locationUrl, setLocationUrl] = useState('');
  // Pinned coordinates from the MapPinPicker. When set, `location_url`
  // is derived from these (an OpenStreetMap link that any browser can
  // open); when cleared, the URL field goes back to whatever the user
  // typed. Storing coordinates separately from the derived URL lets
  // the "Clear pin" affordance restore the URL to empty without
  // touching the user's manual typing.
  const [pinnedLocation, setPinnedLocation] = useState<PinnedLocation | null>(
    null,
  );
  const [pinPickerOpen, setPinPickerOpen] = useState(false);
  const [eventType, setEventType] = useState<EventType>('event');
  const [rsvpEnabled, setRsvpEnabled] = useState(true);
  // Cover image — uploaded to /api/v2/media as soon as the user
  // picks a file (Tal 2026-08-14: "adding an image is possible upon
  // edit, but not in the initial creation"). The returned media id
  // + preview URL live here; on submit we pass the id in the create
  // payload (the controller handles `image_id`). Object-URL preview
  // shown immediately so the thumbnail appears before the upload
  // completes.
  const [imageMediaId, setImageMediaId] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
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

  const hasTitle = title.trim().length > 0;
  const hasStart = startIso !== null;
  const canSubmit = hasTitle && hasStart && !busy && !imageUploading;
  // Pick a single hint that spells out what's blocking submit. Shown
  // whenever the ComposeShell's primary CTA is disabled, so the
  // "hit Post it, nothing happens" trap (Tal 2026-08-14) is answered
  // in-place: greyed button + a line below the form saying exactly
  // why. Not shown while a submit is in flight (busy).
  const submitBlockerMessage = busy
    ? null
    : !hasTitle && !hasStart
      ? messages.needTitleAndStart
      : !hasTitle
        ? messages.needTitle
        : !hasStart
          ? messages.needStart
          : null;

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

  // Force the native date/time picker open on click. Chromium supports
  // `HTMLInputElement.showPicker()` since v99 — without this, some
  // browsers only open the picker when the user clicks the tiny
  // calendar/clock icon at the right edge of the input, which is a
  // frustrating hit target inside a narrow composer field (Tal
  // 2026-08-14: "the date selecter doesn't drop down"). Guarded on
  // `showPicker` existing so older browsers fall back to their
  // default click-to-focus behaviour without erroring.
  const openPickerOnClick = useCallback(
    (e: React.MouseEvent<HTMLInputElement>) => {
      if (typeof e.currentTarget.showPicker === 'function') {
        try {
          e.currentTarget.showPicker();
        } catch {
          // showPicker throws NotAllowedError if called without a user
          // gesture — the click event IS the gesture so this shouldn't
          // fire, but swallowing keeps the composer resilient to
          // vendor-specific edge cases.
        }
      }
    },
    [],
  );

  // Cover image upload — fires the moment the user picks a file so
  // the id is ready by the time they hit Post it. Shows an immediate
  // object-URL preview so the thumbnail appears without waiting for
  // the server round-trip; the object URL is revoked once the server
  // returns a real `preview_url`.
  const onImageChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      const file = e.currentTarget.files?.[0];
      // Reset the input so the same file can be re-picked after a clear
      // (browsers otherwise ignore an unchanged value).
      e.currentTarget.value = '';
      if (!file) return;
      setImageError(null);
      setImageUploading(true);
      const objectUrl = URL.createObjectURL(file);
      setImagePreviewUrl(objectUrl);
      const form = new FormData();
      form.append('file', file);
      void (async () => {
        try {
          const res = await api().post<MediaResponse>('/api/v2/media', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          setImageMediaId(res.data.id);
          // Swap the object URL for the server's preview_url once it's
          // available so we don't leak the blob and the thumbnail
          // matches what viewers will see. Fall back to keeping the
          // object URL if the server didn't ship a preview yet
          // (paperclip previews are async).
          if (res.data.preview_url) {
            URL.revokeObjectURL(objectUrl);
            setImagePreviewUrl(res.data.preview_url);
          }
          setImageUploading(false);
        } catch (err: unknown) {
          URL.revokeObjectURL(objectUrl);
          setImagePreviewUrl(null);
          setImageError(extractApiError(err));
          setImageUploading(false);
        }
      })();
    },
    [],
  );

  const onImageRemove = useCallback(() => {
    if (imagePreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImageMediaId(null);
    setImagePreviewUrl(null);
    setImageError(null);
    setImageUploading(false);
  }, [imagePreviewUrl]);

  const openPinPicker = useCallback(() => {
    setPinPickerOpen(true);
  }, []);
  const cancelPinPicker = useCallback(() => {
    setPinPickerOpen(false);
  }, []);
  // Format an OSM URL for the pinned point. Zoom is clamped for
  // sensible sharing (17 is street-level, higher zooms don't add
  // clarity for "meet here" purposes).
  const handlePin = useCallback((pin: PinnedLocation) => {
    setPinnedLocation(pin);
    const displayZoom = Math.min(17, Math.max(12, Math.round(pin.zoom)));
    setLocationUrl(
      `https://www.openstreetmap.org/?mlat=${pin.lat.toFixed(5)}&mlon=${pin.lng.toFixed(5)}#map=${displayZoom}/${pin.lat.toFixed(5)}/${pin.lng.toFixed(5)}`,
    );
    setPinPickerOpen(false);
  }, []);
  const clearPin = useCallback(() => {
    setPinnedLocation(null);
    setLocationUrl('');
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
    if (imageMediaId) payload.image_id = imageMediaId;

    void (async () => {
      try {
        const res = await api().post<CreatedEvent>('/api/v1/events', payload);
        onCreated(res.data);
        // Parent unmounts on success — no need to reset state.
      } catch (e: unknown) {
        setError(extractApiError(e));
        setBusy(false);
      }
    })();
  }, [
    description,
    endIso,
    eventType,
    imageMediaId,
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
        <div className='event-composer__cover'>
          {imagePreviewUrl ? (
            <div className='event-composer__cover-preview'>
              <img
                src={imagePreviewUrl}
                alt=''
                className='event-composer__cover-image'
              />
              {imageUploading && (
                <span className='event-composer__cover-badge'>
                  <FormattedMessage {...messages.uploadingCover} />
                </span>
              )}
              <button
                type='button'
                className='event-composer__cover-remove'
                onClick={onImageRemove}
                aria-label={intl.formatMessage(messages.removeCover)}
              >
                ×
              </button>
            </div>
          ) : (
            <label className='event-composer__cover-add'>
              <input
                type='file'
                accept='image/*'
                onChange={onImageChange}
                className='event-composer__cover-input'
              />
              <span>
                <FormattedMessage {...messages.addCover} />
              </span>
              <small>
                <FormattedMessage {...messages.cover} />
              </small>
            </label>
          )}
          {imageError && (
            <p className='event-composer__error' role='alert'>
              <FormattedMessage
                {...messages.coverUploadFailed}
                values={{ error: imageError }}
              />
            </p>
          )}
        </div>

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
            <span className='event-composer__field event-composer__field--half'>
              <span className='event-composer__field-label'>
                {intl.formatMessage(messages.starts)}
              </span>
              <div className='event-composer__datetime'>
                <input
                  type='date'
                  aria-label={intl.formatMessage(messages.startDate)}
                  value={startDate}
                  onChange={onStartDate}
                  onClick={openPickerOnClick}
                  required
                  className='event-composer__input'
                />
                <input
                  type='time'
                  aria-label={intl.formatMessage(messages.startTime)}
                  value={startTime}
                  onChange={onStartTime}
                  onClick={openPickerOnClick}
                  required
                  step={SNAP_MINUTES * 60}
                  className='event-composer__input'
                />
              </div>
            </span>
            <span className='event-composer__field event-composer__field--half'>
              <span className='event-composer__field-label'>
                {intl.formatMessage(messages.ends)}
              </span>
              <div className='event-composer__datetime'>
                <input
                  type='date'
                  aria-label={intl.formatMessage(messages.endDate)}
                  value={endDate}
                  onChange={onEndDate}
                  onClick={openPickerOnClick}
                  className='event-composer__input'
                />
                <input
                  type='time'
                  aria-label={intl.formatMessage(messages.endTime)}
                  value={endTime}
                  onChange={onEndTime}
                  onClick={openPickerOnClick}
                  step={SNAP_MINUTES * 60}
                  className='event-composer__input'
                />
              </div>
            </span>
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
                {intl.formatMessage(messages.address)}
              </span>
              <input
                type='text'
                value={locationName}
                onChange={onLocationName}
                placeholder={intl.formatMessage(messages.addressPlaceholder)}
                className='event-composer__input'
              />
            </label>
            <label className='event-composer__field'>
              <span className='event-composer__field-label'>
                {intl.formatMessage(messages.mapLink)}
              </span>
              <input
                type='url'
                value={locationUrl}
                onChange={onLocationUrl}
                placeholder={intl.formatMessage(messages.mapLinkPlaceholder)}
                className='event-composer__input'
              />
              <small className='event-composer__field-hint'>
                {intl.formatMessage(messages.mapLinkHint)}
              </small>
              <div className='event-composer__pin-row'>
                <button
                  type='button'
                  className='event-composer__pin-btn'
                  onClick={openPinPicker}
                >
                  <FormattedMessage {...messages.pinOnMap} />
                </button>
                {pinnedLocation && (
                  <>
                    <span className='event-composer__pin-coords'>
                      <FormattedMessage
                        {...messages.pinnedAt}
                        values={{
                          lat: pinnedLocation.lat.toFixed(4),
                          lng: pinnedLocation.lng.toFixed(4),
                        }}
                      />
                    </span>
                    <button
                      type='button'
                      className='event-composer__pin-clear'
                      onClick={clearPin}
                    >
                      <FormattedMessage {...messages.clearPin} />
                    </button>
                  </>
                )}
              </div>
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

        {submitBlockerMessage && (
          <p className='event-composer__submit-hint'>
            <FormattedMessage {...submitBlockerMessage} />
          </p>
        )}
      </div>

      {pinPickerOpen && (
        <MapPinPicker
          initial={pinnedLocation ?? undefined}
          onCancel={cancelPinPicker}
          onPin={handlePin}
        />
      )}
    </ComposeShell>
  );
};
