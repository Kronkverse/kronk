import { useState, useCallback, useRef } from 'react';
import { FormattedMessage } from 'react-intl';
import { Icon } from 'mastodon/components/icon';
import CalendarMonthIcon from '@/material-icons/400-24px/calendar_month.svg?react';
import VideocamIcon from '@/material-icons/400-24px/diversity_2.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import AddPhotoIcon from '@/material-icons/400-24px/add_photo_alternate.svg?react';
import RepeatIcon from '@/material-icons/400-24px/repeat.svg?react';
import api from 'mastodon/api';

type Event = {
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
  account: any;
  status_id: string | null;
  image_url: string | null;
  is_owner: boolean;
};

type Props = {
  onEventCreated: (event: Event) => void;
  onCancel: () => void;
  editEvent?: Event | null;
};

const toLocalDatetime = (isoString: string) => {
  const d = new Date(isoString);
  const date = d.toISOString().split('T')[0];
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

  const handleClick = () => {
    try {
      inputRef.current?.showPicker();
    } catch {
      inputRef.current?.focus();
    }
  };

  return (
    <div className='create-event-form__datetime-btn' onClick={handleClick}>
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

export const CreateEventForm: React.FC<Props> = ({ onEventCreated, onCancel, editEvent }) => {
  const editing = !!editEvent;
  const startInit = editEvent ? toLocalDatetime(editEvent.start_time) : { date: '', time: '' };
  const endInit = editEvent?.end_time ? toLocalDatetime(editEvent.end_time) : { date: '', time: '' };

  const [title, setTitle] = useState(editEvent?.title || '');
  const [description, setDescription] = useState(editEvent?.description || '');
  const [startDate, setStartDate] = useState(startInit.date);
  const [startTime, setStartTime] = useState(startInit.time);
  const [endDate, setEndDate] = useState(endInit.date);
  const [endTime, setEndTime] = useState(endInit.time);
  const [locationName, setLocationName] = useState(editEvent?.location_name || '');
  const [locationUrl, setLocationUrl] = useState(editEvent?.location_url ?? '');
  const [eventType, setEventType] = useState(editEvent?.event_type || 'event');
  const [visibility, setVisibility] = useState('public');
  const [rsvpEnabled, setRsvpEnabled] = useState(editEvent?.rsvp_enabled ?? true);
  const [recurrenceRule, setRecurrenceRule] = useState(editEvent?.recurrence_rule || '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(editEvent?.image_url || null);
  const [removeImage, setRemoveImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setRemoveImage(false);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(true);
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !startDate || !startTime) return;

    const startDt = new Date(`${startDate}T${startTime}`);
    const endDt = endDate && endTime ? new Date(`${endDate}T${endTime}`) : null;

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
        const uploadRes = await api().post('/api/v1/media', formData);
        imageId = (uploadRes.data as any).id;
      }

      const startDateTime = startDt.toISOString();
      const endDateTime = endDt ? endDt.toISOString() : null;

      const payload: Record<string, any> = {
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
      if (editing && editEvent) {
        response = await api().put(`/api/v1/events/${editEvent.id}`, payload);
      } else {
        response = await api().post('/api/v1/events', payload);
      }

      onEventCreated(response.data as Event);
    } catch (err) {
      console.error('Failed to save event:', err);
    } finally {
      setSubmitting(false);
    }
  }, [title, description, startDate, startTime, endDate, endTime, locationName, locationUrl, eventType, visibility, rsvpEnabled, recurrenceRule, imageFile, removeImage, editing, editEvent, onEventCreated]);

  const handleEventTypeChange = (type: string) => {
    setEventType(type);
    if (type === 'huddle') {
      setLocationName('');
    }
  };

  return (
    <form className='create-event-form' onSubmit={handleSubmit}>
      <div className='create-event-form__header'>
        <h3>
          {editing ? (
            <FormattedMessage id='events.edit_event' defaultMessage='Edit Event' />
          ) : eventType === 'huddle' ? (
            <FormattedMessage id='events.create_huddle' defaultMessage='Schedule a Huddle' />
          ) : (
            <FormattedMessage id='events.create_event' defaultMessage='Create Event' />
          )}
        </h3>
        <button type='button' className='create-event-form__close' onClick={onCancel}>
          <Icon id='close' icon={CloseIcon} />
        </button>
      </div>

      {!editing && (
        <div className='create-event-form__type-toggle'>
          <button
            type='button'
            className={`create-event-form__type-btn ${eventType === 'event' ? 'active' : ''}`}
            onClick={() => handleEventTypeChange('event')}
          >
            <Icon id='calendar_month' icon={CalendarMonthIcon} /> Event
          </button>
          <button
            type='button'
            className={`create-event-form__type-btn ${eventType === 'huddle' ? 'active' : ''}`}
            onClick={() => handleEventTypeChange('huddle')}
          >
            <Icon id='videocam' icon={VideocamIcon} /> Huddle
          </button>
        </div>
      )}

      <div className='create-event-form__field'>
        <label><FormattedMessage id='events.form.title' defaultMessage='Title' /></label>
        <input
          type='text'
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder='Event name...'
          maxLength={200}
          required
        />
      </div>

      <div className='create-event-form__image-upload'>
        <label><FormattedMessage id='events.form.cover_image' defaultMessage='Cover image' /></label>
        {imagePreview ? (
          <div className='create-event-form__image-preview'>
            <img src={imagePreview} alt='' />
            <button type='button' className='create-event-form__image-remove' onClick={handleRemoveImage}>
              <Icon id='close' icon={CloseIcon} />
            </button>
          </div>
        ) : (
          <label className='create-event-form__image-picker'>
            <Icon id='add_photo' icon={AddPhotoIcon} />
            <span><FormattedMessage id='events.form.add_image' defaultMessage='Add cover image' /></span>
            <input type='file' accept='image/*' onChange={handleImageChange} hidden />
          </label>
        )}
      </div>

      <div className='create-event-form__row'>
        <div className='create-event-form__field'>
          <label><FormattedMessage id='events.form.start' defaultMessage='Start' /></label>
          <div className='create-event-form__datetime'>
            <ClickableInput type='date' value={startDate} onChange={e => setStartDate(e.target.value)} required />
            <ClickableInput type='time' value={startTime} onChange={e => setStartTime(e.target.value)} required />
          </div>
        </div>
        <div className='create-event-form__field'>
          <label><FormattedMessage id='events.form.end' defaultMessage='End' /></label>
          <div className='create-event-form__datetime'>
            <ClickableInput type='date' value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} />
            <ClickableInput type='time' value={endTime} onChange={e => setEndTime(e.target.value)} />
          </div>
        </div>
      </div>

      {eventType !== 'huddle' && (
        <div className='create-event-form__field'>
          <label><FormattedMessage id='events.form.location' defaultMessage='Location' /></label>
          <input type='text' value={locationName} onChange={e => setLocationName(e.target.value)} placeholder='Where is it?' maxLength={200} />
        </div>
      )}

      <div className='create-event-form__field'>
        <label><FormattedMessage id='events.form.link' defaultMessage='Link' /></label>
        <input type='url' value={locationUrl} onChange={e => setLocationUrl(e.target.value)} placeholder='https://...' maxLength={500} />
      </div>

      <div className='create-event-form__field'>
        <label><FormattedMessage id='events.form.description' defaultMessage='Description' /></label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder='Tell people about this event...' rows={3} maxLength={5000} />
      </div>

      <div className='create-event-form__row'>
        {!editing && (
          <div className='create-event-form__field'>
            <label><FormattedMessage id='events.form.visibility' defaultMessage='Visibility' /></label>
            <select value={visibility} onChange={e => setVisibility(e.target.value)}>
              <option value='public'>Public</option>
              <option value='unlisted'>Unlisted</option>
              <option value='private'>Followers only</option>
              <option value='direct'>Mentioned only</option>
            </select>
          </div>
        )}
        <div className='create-event-form__field'>
          <label><FormattedMessage id='events.form.repeat' defaultMessage='Repeat' /></label>
          <select value={recurrenceRule} onChange={e => setRecurrenceRule(e.target.value)}>
            <option value=''>None</option>
            <option value='FREQ=DAILY'>Daily</option>
            <option value='FREQ=WEEKLY'>Weekly</option>
            <option value='FREQ=WEEKLY;INTERVAL=2'>Fortnightly</option>
            <option value='FREQ=MONTHLY'>Monthly</option>
          </select>
        </div>
      </div>

      <label className='create-event-form__checkbox'>
        <input type='checkbox' checked={rsvpEnabled} onChange={e => setRsvpEnabled(e.target.checked)} />
        <FormattedMessage id='events.form.rsvp' defaultMessage='Enable RSVPs' />
      </label>

      <div className='create-event-form__actions'>
        <button type='button' className='create-event-form__cancel' onClick={onCancel}>
          <FormattedMessage id='events.form.cancel' defaultMessage='Cancel' />
        </button>
        <button type='submit' className='create-event-form__submit' disabled={submitting || !title || !startDate || !startTime}>
          {editing ? (
            <FormattedMessage id='events.form.save_changes' defaultMessage='Save Changes' />
          ) : eventType === 'huddle' ? (
            <FormattedMessage id='events.form.schedule_huddle' defaultMessage='Schedule Huddle' />
          ) : (
            <FormattedMessage id='events.form.create_event' defaultMessage='Create Event' />
          )}
        </button>
      </div>
    </form>
  );
};
