import { useCallback, useEffect, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import type { IntlShape } from 'react-intl';

import type { AttachmentCandidateJSON } from 'mastodon/api/attachments';
import { apiSearchAttachmentCandidates } from 'mastodon/api/attachments';

// EventSearch — pick one Kalendar event by searching for it, for a form
// field that needs an event (a Krew's "Attending an event" requirement).
// The same search the Konnect picker runs (`/api/v1/attachments/candidates`
// on Kalendar, so only events the viewer can see): upcoming by default,
// past ones a tap away. The pick shows as a chip with Change. Drawn with the
// compose-time Konnect bar's search classes (`_kronk_attachment.scss`), which
// are the same search-and-pick in a form.

export interface PickedEvent {
  id: string;
  title: string | null;
  starts_at?: string | null;
}

const messages = defineMessages({
  placeholder: {
    id: 'event_search.placeholder',
    defaultMessage: 'Search Kalendar events…',
  },
  searching: { id: 'event_search.searching', defaultMessage: 'Searching…' },
  noResults: { id: 'event_search.no_results', defaultMessage: 'No matches.' },
  showPast: {
    id: 'event_search.show_past',
    defaultMessage: 'Show past events',
  },
  showUpcoming: {
    id: 'event_search.show_upcoming',
    defaultMessage: 'Show upcoming events',
  },
  change: { id: 'event_search.change', defaultMessage: 'Change' },
  anEvent: { id: 'event_search.an_event', defaultMessage: 'An event' },
  titleAndDate: {
    id: 'event_search.title_and_date',
    defaultMessage: '{title} · {date}',
  },
});

// "Summer picnic · Sat, 14 Nov 2026" — or "An event" when the title isn't
// known (the viewer can't see it, or a draft saved before titles were kept).
export const eventLabel = (
  intl: IntlShape,
  event: { title?: string | null; starts_at?: string | null } | null,
): string => {
  const title = event?.title ?? intl.formatMessage(messages.anEvent);
  if (!event?.starts_at) return title;
  const date = intl.formatDate(event.starts_at, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return intl.formatMessage(messages.titleAndDate, { title, date });
};

interface Props {
  value: PickedEvent | null;
  onChange: (event: PickedEvent | null) => void;
  disabled?: boolean;
  // Names the search box for assistive tech (the field's label).
  label?: string;
}

export const EventSearch: React.FC<Props> = ({
  value,
  onChange,
  disabled = false,
  label,
}) => {
  const intl = useIntl();
  const [query, setQuery] = useState('');
  const [past, setPast] = useState(false);
  const [results, setResults] = useState<AttachmentCandidateJSON[]>([]);
  const [searching, setSearching] = useState(false);

  const picked = value !== null;

  // Debounced, like the Konnect picker.
  useEffect(() => {
    if (picked) return undefined;
    const trimmed = query.trim();
    let cancelled = false;
    setSearching(true);

    const timer = window.setTimeout(() => {
      apiSearchAttachmentCandidates('kalendar', trimmed, 20, past)
        .then((rows) => {
          if (!cancelled) setResults(rows);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [picked, query, past]);

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
    },
    [],
  );

  const handleTogglePast = useCallback(() => {
    setPast((p) => !p);
  }, []);

  const handlePick = useCallback(
    (row: AttachmentCandidateJSON) => {
      onChange({ id: row.id, title: row.title, starts_at: row.starts_at });
    },
    [onChange],
  );

  const handleChange = useCallback(() => {
    onChange(null);
  }, [onChange]);

  if (value) {
    return (
      <div className='compose-attach-bar__picked'>
        <span>{eventLabel(intl, value)}</span>
        <button
          type='button'
          className='compose-attach-bar__picked-change'
          onClick={handleChange}
          disabled={disabled}
        >
          <FormattedMessage {...messages.change} />
        </button>
      </div>
    );
  }

  return (
    <>
      <input
        type='search'
        className='compose-attach-bar__search'
        value={query}
        onChange={handleQueryChange}
        disabled={disabled}
        aria-label={label}
        placeholder={intl.formatMessage(messages.placeholder)}
      />
      <button
        type='button'
        className='compose-attach-bar__when'
        onClick={handleTogglePast}
        disabled={disabled}
      >
        <FormattedMessage
          {...(past ? messages.showUpcoming : messages.showPast)}
        />
      </button>
      <div className='compose-attach-bar__results' role='listbox'>
        {searching && (
          <p className='compose-attach-bar__status'>
            <FormattedMessage {...messages.searching} />
          </p>
        )}
        {!searching && results.length === 0 && (
          <p className='compose-attach-bar__status'>
            <FormattedMessage {...messages.noResults} />
          </p>
        )}
        {!searching &&
          results.map((row) => (
            <EventRow
              key={row.id}
              row={row}
              disabled={disabled}
              onPick={handlePick}
            />
          ))}
      </div>
    </>
  );
};

const EventRow: React.FC<{
  row: AttachmentCandidateJSON;
  disabled: boolean;
  onPick: (row: AttachmentCandidateJSON) => void;
}> = ({ row, disabled, onPick }) => {
  const intl = useIntl();
  const handleClick = useCallback(() => {
    onPick(row);
  }, [onPick, row]);
  return (
    <button
      type='button'
      className='compose-attach-bar__result'
      onClick={handleClick}
      disabled={disabled}
      role='option'
      aria-selected='false'
    >
      {eventLabel(intl, row)}
    </button>
  );
};
