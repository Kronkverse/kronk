import { useCallback, useEffect, useRef, useState } from 'react';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import api from 'mastodon/api';

interface KalendarEvent {
  id: string;
  title: string;
  start_time: string;
}

export interface EventSelection {
  id: string;
  name: string;
  date: string;
}

interface OptionProps {
  event: KalendarEvent;
  onSelect: (e: KalendarEvent) => void;
}

const EventOption: React.FC<OptionProps> = ({ event, onSelect }) => {
  const handleMouseDown = useCallback(() => {
    onSelect(event);
  }, [event, onSelect]);

  const dateStr = new Date(event.start_time).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <button
      type='button'
      className='booth-event-combobox__option'
      onMouseDown={handleMouseDown}
    >
      <span className='booth-event-combobox__option-title'>{event.title}</span>
      <span className='booth-event-combobox__option-date'>{dateStr}</span>
    </button>
  );
};

interface Props {
  eventId: string | null;
  eventName: string;
  onLink: (data: EventSelection) => void;
  onNameChange: (name: string) => void;
  onClear: () => void;
  disabled?: boolean;
}

export const EventCombobox: React.FC<Props> = ({
  eventId,
  eventName,
  onLink,
  onNameChange,
  onClear,
  disabled,
}) => {
  const [open, setOpen] = useState(false);
  const [allEvents, setAllEvents] = useState<KalendarEvent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || allEvents !== null || loading) return;
    setLoading(true);
    void (async () => {
      try {
        const [upcoming, past] = await Promise.all([
          api().get<KalendarEvent[]>('/api/v1/events'),
          api().get<KalendarEvent[]>('/api/v1/events?filter=past'),
        ]);
        const seen = new Set<string>();
        const merged: KalendarEvent[] = [];
        for (const e of [...upcoming.data, ...past.data]) {
          if (!seen.has(e.id)) {
            seen.add(e.id);
            merged.push(e);
          }
        }
        merged.sort(
          (a, b) =>
            new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
        );
        setAllEvents(merged);
      } catch {
        setAllEvents([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, allEvents, loading]);

  const handleFocus = useCallback(() => {
    setOpen(true);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onNameChange(e.target.value);
      setOpen(true);
    },
    [onNameChange],
  );

  const handleSelect = useCallback(
    (event: KalendarEvent) => {
      const date = event.start_time.split('T')[0] ?? '';
      onLink({ id: event.id, name: event.title, date });
      setOpen(false);
    },
    [onLink],
  );

  const handleClear = useCallback(() => {
    onClear();
    setOpen(false);
  }, [onClear]);

  const handleBlur = useCallback(() => {
    setTimeout(() => {
      if (
        wrapRef.current &&
        !wrapRef.current.contains(document.activeElement)
      ) {
        setOpen(false);
      }
    }, 0);
  }, []);

  const filtered =
    allEvents?.filter((e) =>
      e.title.toLowerCase().includes(eventName.toLowerCase()),
    ) ?? [];

  return (
    <div ref={wrapRef} className='booth-event-combobox' onBlur={handleBlur}>
      <div className='booth-event-combobox__input-row'>
        <input
          type='text'
          className={`booth-event-combobox__input${eventId ? ' booth-event-combobox__input--linked' : ''}`}
          value={eventName}
          onChange={handleChange}
          onFocus={handleFocus}
          disabled={disabled}
          placeholder='Event name (optional)'
          maxLength={200}
          autoComplete='off'
        />
        {eventId && (
          <>
            <span className='booth-event-combobox__badge'>Kalendar</span>
            <button
              type='button'
              className='booth-event-combobox__clear'
              onClick={handleClear}
              aria-label='Unlink event'
              tabIndex={-1}
              disabled={disabled}
            >
              <CloseIcon />
            </button>
          </>
        )}
      </div>

      {open && !eventId && (
        <div className='booth-event-combobox__dropdown'>
          {loading && (
            <div className='booth-event-combobox__hint'>Loading events…</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className='booth-event-combobox__hint'>No matching events</div>
          )}
          {!loading &&
            filtered.map((event) => (
              <EventOption
                key={event.id}
                event={event}
                onSelect={handleSelect}
              />
            ))}
        </div>
      )}
    </div>
  );
};
