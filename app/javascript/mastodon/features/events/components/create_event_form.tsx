import { useState, useCallback, useRef } from 'react';

import { FormattedMessage } from 'react-intl';

import AddPhotoIcon from '@/material-icons/400-24px/add_photo_alternate.svg?react';
import CalendarMonthIcon from '@/material-icons/400-24px/calendar_month.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import VideocamIcon from '@/material-icons/400-24px/diversity_2.svg?react';
import api from 'mastodon/api';
import { Icon } from 'mastodon/components/icon';

interface Account {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  url: string;
}

interface Event {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string | null;
  location_name: string | null;
  location_url: string | null;
  event_type: string;
  huddle_url: string | null;
  rsvp_enabled: boolean;
  max_attendees: number | null;
  recurrence_rule: string | null;
  going_count: number;
  interested_count: number;
  rsvp: string | null;
  invited: boolean;
  cancelled: boolean;
  account: Account;
  status_id: string | null;
  image_url: string | null;
  is_owner: boolean;
}

interface MediaUploadResponse {
  id: string;
}

interface Props {
  onEventCreated: (event: Event) => void;
  onCancel: () => void;
  editEvent?: Event | null;
}

const toLocalDatetime = (isoString: string) => {
  const d = new Date(isoString);
  const date = d.toISOString().split('T')[0] ?? '';
  const time = d.toTimeString().slice(0, 5);
  return { date, time };
};

const ClickableInput: React.FC<{
  type: 'date' | 'time';
  value: string | undefined;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  placeholder?: string;
  min?: string;
}> = ({ type, value, onChange, required, placeholder, min }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    try {
      inputRef.current?.showPicker();
    } catch {
      inputRef.current?.focus();
    }
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      try {
        inputRef.current?.showPicker();
      } catch {
        inputRef.current?.focus();
      }
    }
  }, []);

  return (
    <div
      className='create-event-form__datetime-btn'
      role='button'
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        min={min}
      />
    </div>
  );
};

export const CreateEventForm: React.FC<Props> = ({
  onEventCreated,
  onCancel,
  editEvent,
}) => {
  const editing = !!editEvent;
  const startInit = editEvent
    ? toLocalDatetime(editEvent.start_time)
    : { date: '', time: '' };
  const endInit = editEvent?.end_time
    ? toLocalDatetime(editEvent.end_time)
    : { date: '', time: '' };

  const [title, setTitle] = useState(editEvent?.title ?? '');
  const [description, setDescription] = useState(editEvent?.description ?? '');
  const [startDate, setStartDate] = useState(startInit.date);
  const [startTime, setStartTime] = useState(startInit.time);
  const [endDate, setEndDate] = useState(endInit.date);
  const [endTime, setEndTime] = useState(endInit.time);
  const [locationName, setLocationName] = useState(
    editEvent?.location_name ?? '',
  );
  const [locationUrl, setLocationUrl] = useState(editEvent?.location_url ?? '');
  const [eventType, setEventType] = useState(editEvent?.event_type ?? 'event');
  const [visibility, setVisibility] = useState('public');
  const [rsvpEnabled, setRsvpEnabled] = useState(
    editEvent?.rsvp_enabled ?? true,
  );
  const [recurrenceRule, setRecurrenceRule] = useState(
    editEvent?.recurrence_rule ?? '',
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    editEvent?.image_url ?? null,
  );
  const [removeImage, setRemoveImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleImageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
        setRemoveImage(false);
      }
    },
    [],
  );

  const handleRemoveImage = useCallback(() => {
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(true);
  }, []);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTitle(e.target.value);
    },
    [],
  );

  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDescription(e.target.value);
    },
    [],
  );

  const handleStartDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setStartDate(e.target.value);
    },
    [],
  );

  const handleStartTimeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setStartTime(e.target.value);
    },
    [],
  );

  const handleEndDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEndDate(e.target.value);
    },
    [],
  );

  const handleEndTimeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEndTime(e.target.value);
    },
    [],
  );

  const handleLocationNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocationName(e.target.value);
    },
    [],
  );

  const handleLocationUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocationUrl(e.target.value);
    },
    [],
  );

  const handleVisibilityChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setVisibility(e.target.value);
    },
    [],
  );

  const handleRecurrenceChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setRecurrenceRule(e.target.value);
    },
    [],
  );

  const handleRsvpChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setRsvpEnabled(e.target.checked);
    },
    [],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!title || !startDate || !startTime) return;

      const startDt = new Date(`${startDate}T${startTime}`);
      const endDt =
        endDate && endTime ? new Date(`${endDate}T${endTime}`) : null;

      if (endDt && endDt <= startDt) {
        alert('End time must be after start time');
        return;
      }

      setSubmitting(true);
      try {
        let imageId: string | null = null;

        if (imageFile) {
          const formData = new FormData();
          formData.append('file', imageFile);
          const uploadRes = await api().post<MediaUploadResponse>(
            '/api/v1/media',
            formData,
          );
          imageId = uploadRes.data.id;
        }

        const startDateTime = startDt.toISOString();
        const endDateTime = endDt ? endDt.toISOString() : null;

        const payload: Record<string, string | boolean | null> = {
          title,
          description,
          start_time: startDateTime,
          end_time: endDateTime,
          location_name: locationName || null,
          location_url: locationUrl || null,
          event_type: eventType,
          rsvp_enabled: rsvpEnabled,
          recurrence_rule: recurrenceRule || null,
        };

        if (!editing) {
          payload.visibility = visibility;
        }

        if (imageId) {
          payload.image_id = imageId;
        } else if (removeImage) {
          payload.remove_image = 'true';
        }

        let response;
        if (editEvent) {
          response = await api().put<Event>(
            `/api/v1/events/${editEvent.id}`,
            payload,
          );
        } else {
          response = await api().post<Event>('/api/v1/events', payload);
        }

        onEventCreated(response.data);
      } catch (err) {
        console.error('Failed to save event:', err);
      } finally {
        setSubmitting(false);
      }
    },
    [
      title,
      description,
      startDate,
      startTime,
      endDate,
      endTime,
      locationName,
      locationUrl,
      eventType,
      visibility,
      rsvpEnabled,
      recurrenceRule,
      imageFile,
      removeImage,
      editing,
      editEvent,
      onEventCreated,
    ],
  );

  const handleSelectEvent = useCallback(() => {
    setEventType('event');
  }, []);

  const handleSelectHuddle = useCallback(() => {
    setEventType('huddle');
    setLocationName('');
  }, []);

  const titleInputId = 'event-form-title';
  const locationInputId = 'event-form-location';
  const linkInputId = 'event-form-link';
  const descriptionInputId = 'event-form-description';
  const visibilityInputId = 'event-form-visibility';
  const repeatInputId = 'event-form-repeat';
  const rsvpInputId = 'event-form-rsvp';
  const startLabelId = 'event-form-start';
  const endLabelId = 'event-form-end';
  const coverLabelId = 'event-form-cover';

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      void handleSubmit(e);
    },
    [handleSubmit],
  );

  return (
    <form className='create-event-form' onSubmit={onSubmit}>
      <div className='create-event-form__header'>
        <h3>
          {editing ? (
            <FormattedMessage
              id='events.edit_event'
              defaultMessage='Edit Event'
            />
          ) : eventType === 'huddle' ? (
            <FormattedMessage
              id='events.create_huddle'
              defaultMessage='Schedule a Huddle'
            />
          ) : (
            <FormattedMessage
              id='events.create_event'
              defaultMessage='Create Event'
            />
          )}
        </h3>
        <button
          type='button'
          className='create-event-form__close'
          onClick={onCancel}
        >
          <Icon id='close' icon={CloseIcon} />
        </button>
      </div>

      {!editing && (
        <div className='create-event-form__type-toggle'>
          <button
            type='button'
            className={`create-event-form__type-btn ${eventType === 'event' ? 'active' : ''}`}
            onClick={handleSelectEvent}
          >
            <Icon id='calendar_month' icon={CalendarMonthIcon} /> Event
          </button>
          <button
            type='button'
            className={`create-event-form__type-btn ${eventType === 'huddle' ? 'active' : ''}`}
            onClick={handleSelectHuddle}
          >
            <Icon id='videocam' icon={VideocamIcon} /> Huddle
          </button>
        </div>
      )}

      <div className='create-event-form__field'>
        <label htmlFor={titleInputId}>
          <FormattedMessage id='events.form.title' defaultMessage='Title' />
        </label>
        <input
          id={titleInputId}
          type='text'
          value={title}
          onChange={handleTitleChange}
          placeholder='Event name...'
          maxLength={200}
          required
        />
      </div>

      <div className='create-event-form__image-upload'>
        <span id={coverLabelId}>
          <FormattedMessage
            id='events.form.cover_image'
            defaultMessage='Cover image'
          />
        </span>
        {imagePreview ? (
          <div className='create-event-form__image-preview'>
            <img src={imagePreview} alt='' />
            <button
              type='button'
              className='create-event-form__image-remove'
              onClick={handleRemoveImage}
            >
              <Icon id='close' icon={CloseIcon} />
            </button>
          </div>
        ) : (
          <label className='create-event-form__image-picker'>
            <Icon id='add_photo' icon={AddPhotoIcon} />
            <span>
              <FormattedMessage
                id='events.form.add_image'
                defaultMessage='Add cover image'
              />
            </span>
            <input
              type='file'
              accept='image/*'
              onChange={handleImageChange}
              hidden
            />
          </label>
        )}
      </div>

      <div className='create-event-form__row'>
        <div className='create-event-form__field'>
          <span id={startLabelId}>
            <FormattedMessage id='events.form.start' defaultMessage='Start' />
          </span>
          <div
            className='create-event-form__datetime'
            aria-labelledby={startLabelId}
          >
            <ClickableInput
              type='date'
              value={startDate}
              onChange={handleStartDateChange}
              required
            />
            <ClickableInput
              type='time'
              value={startTime}
              onChange={handleStartTimeChange}
              required
            />
          </div>
        </div>
        <div className='create-event-form__field'>
          <span id={endLabelId}>
            <FormattedMessage id='events.form.end' defaultMessage='End' />
          </span>
          <div
            className='create-event-form__datetime'
            aria-labelledby={endLabelId}
          >
            <ClickableInput
              type='date'
              value={endDate}
              onChange={handleEndDateChange}
              min={startDate}
            />
            <ClickableInput
              type='time'
              value={endTime}
              onChange={handleEndTimeChange}
            />
          </div>
        </div>
      </div>

      {eventType !== 'huddle' && (
        <div className='create-event-form__field'>
          <label htmlFor={locationInputId}>
            <FormattedMessage
              id='events.form.location'
              defaultMessage='Location'
            />
          </label>
          <input
            id={locationInputId}
            type='text'
            value={locationName}
            onChange={handleLocationNameChange}
            placeholder='Where is it?'
            maxLength={200}
          />
        </div>
      )}

      <div className='create-event-form__field'>
        <label htmlFor={linkInputId}>
          <FormattedMessage id='events.form.link' defaultMessage='Link' />
        </label>
        <input
          id={linkInputId}
          type='url'
          value={locationUrl}
          onChange={handleLocationUrlChange}
          placeholder='https://...'
          maxLength={500}
        />
      </div>

      <div className='create-event-form__field'>
        <label htmlFor={descriptionInputId}>
          <FormattedMessage
            id='events.form.description'
            defaultMessage='Description'
          />
        </label>
        <textarea
          id={descriptionInputId}
          value={description}
          onChange={handleDescriptionChange}
          placeholder='Tell people about this event...'
          rows={3}
          maxLength={5000}
        />
      </div>

      <div className='create-event-form__row'>
        {!editing && (
          <div className='create-event-form__field'>
            <label htmlFor={visibilityInputId}>
              <FormattedMessage
                id='events.form.visibility'
                defaultMessage='Visibility'
              />
            </label>
            <select
              id={visibilityInputId}
              value={visibility}
              onChange={handleVisibilityChange}
            >
              <option value='public'>Public</option>
              <option value='unlisted'>Unlisted</option>
              <option value='private'>Followers only</option>
              <option value='direct'>Mentioned only</option>
            </select>
          </div>
        )}
        <div className='create-event-form__field'>
          <label htmlFor={repeatInputId}>
            <FormattedMessage id='events.form.repeat' defaultMessage='Repeat' />
          </label>
          <select
            id={repeatInputId}
            value={recurrenceRule}
            onChange={handleRecurrenceChange}
          >
            <option value=''>None</option>
            <option value='FREQ=DAILY'>Daily</option>
            <option value='FREQ=WEEKLY'>Weekly</option>
            <option value='FREQ=WEEKLY;INTERVAL=2'>Fortnightly</option>
            <option value='FREQ=MONTHLY'>Monthly</option>
          </select>
        </div>
      </div>

      <label htmlFor={rsvpInputId} className='create-event-form__checkbox'>
        <input
          id={rsvpInputId}
          type='checkbox'
          checked={rsvpEnabled}
          onChange={handleRsvpChange}
        />
        <FormattedMessage id='events.form.rsvp' defaultMessage='Enable RSVPs' />
      </label>

      <div className='create-event-form__actions'>
        <button
          type='button'
          className='create-event-form__cancel'
          onClick={onCancel}
        >
          <FormattedMessage id='events.form.cancel' defaultMessage='Cancel' />
        </button>
        <button
          type='submit'
          className='create-event-form__submit'
          disabled={submitting || !title || !startDate || !startTime}
        >
          {editing ? (
            <FormattedMessage
              id='events.form.save_changes'
              defaultMessage='Save Changes'
            />
          ) : eventType === 'huddle' ? (
            <FormattedMessage
              id='events.form.schedule_huddle'
              defaultMessage='Schedule Huddle'
            />
          ) : (
            <FormattedMessage
              id='events.form.create_event'
              defaultMessage='Create Event'
            />
          )}
        </button>
      </div>
    </form>
  );
};
