import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import { apiGetRoses } from 'mastodon/api/rose';
import type { ApiRoseJSON } from 'mastodon/api_types/rose';
import { LoadingIndicator } from 'mastodon/components/loading_indicator';
import { kornerIcon } from 'mastodon/hooks/useKornerIcon';

// The day's stack: today's roses, drawn outward from the centre.
//
// The first rose sits in the middle and each one after it takes the next
// place beside the last, alternating sides, so the arrangement is the
// content — no one flower is the point. Tapping a rose names who sent
// it; until then the stack is plain.
//
// Empty is the normal state for most of the day and reads as calm, not
// as a failure. Nothing here pages: a day's stack is bounded by how many
// Mates you have.

const messages = defineMessages({
  empty: {
    id: 'rose.empty',
    defaultMessage: 'No roses yet today.',
  },
  error: {
    id: 'rose.error',
    defaultMessage: "Couldn't load your roses. Try again in a moment.",
  },
  from: {
    id: 'rose.from',
    defaultMessage: 'From {name}',
  },
  rose: {
    id: 'rose.one',
    defaultMessage: 'A rose. Tap to see who it is from.',
  },
  clears: {
    id: 'rose.clears',
    defaultMessage: 'Your roses clear at 3am.',
  },
});

// Arrival order in, outward-from-centre order out: the first rose is
// the middle, odd arrivals go right, even arrivals go left.
const arrangeOutward = (roses: ApiRoseJSON[]): ApiRoseJSON[] => {
  const left: ApiRoseJSON[] = [];
  const right: ApiRoseJSON[] = [];

  roses.forEach((rose, index) => {
    if (index % 2 === 0) {
      right.push(rose);
    } else {
      left.unshift(rose);
    }
  });

  return [...left, ...right];
};

const Bloom: React.FC<{
  rose: ApiRoseJSON;
  label: string;
  selected: boolean;
  onSelect: (id: string) => void;
}> = ({ rose, label, selected, onSelect }) => {
  const RoseGlyph = kornerIcon('rose');

  const handleClick = useCallback(() => {
    onSelect(rose.id);
  }, [onSelect, rose.id]);

  return (
    <button
      type='button'
      className='rose__bloom'
      aria-pressed={selected}
      title={label}
      onClick={handleClick}
    >
      <RoseGlyph aria-label={label} />
    </button>
  );
};

export const RoseStackView: React.FC = () => {
  const intl = useIntl();
  const [roses, setRoses] = useState<ApiRoseJSON[] | null>(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiGetRoses()
      .then((data) => {
        if (!cancelled) setRoses(data);
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const arranged = useMemo(() => arrangeOutward(roses ?? []), [roses]);

  const handleSelect = useCallback((id: string) => {
    setSelected((current) => (current === id ? null : id));
  }, []);

  if (error) {
    return (
      <div className='rose__status' role='alert'>
        {intl.formatMessage(messages.error)}
      </div>
    );
  }

  if (roses === null) {
    return <LoadingIndicator />;
  }

  const shown = arranged.find((rose) => rose.id === selected);

  return (
    <div className='rose__stage'>
      {arranged.length === 0 ? (
        <p className='rose__empty'>{intl.formatMessage(messages.empty)}</p>
      ) : (
        <div className='rose__stack'>
          {arranged.map((rose) => (
            <Bloom
              key={rose.id}
              rose={rose}
              label={intl.formatMessage(messages.rose)}
              selected={selected === rose.id}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}

      {shown && (
        <Link className='rose__from' to={`/@${shown.from_account.acct}`}>
          {intl.formatMessage(messages.from, {
            name:
              shown.from_account.display_name || shown.from_account.username,
          })}
        </Link>
      )}

      {arranged.length > 0 && (
        <p className='rose__footnote'>{intl.formatMessage(messages.clears)}</p>
      )}
    </div>
  );
};
