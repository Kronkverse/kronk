import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type { ApiPresencePinJSON } from 'mastodon/api/map';

// The people strip — a face per pin currently on the map. Tapping one centres
// the map on that person. Mirrors the Moments home strip (features/moments/
// home_strip.tsx): a scroller of avatar tiles, self forced leftmost/topmost.
// The Frame gives it a vertical rail on desktop and a horizontal band on phone
// (see .map-people in _map.scss).

const messages = defineMessages({
  label: { id: 'map.people.label', defaultMessage: 'People on the map' },
  you: { id: 'map.people.you', defaultMessage: 'You' },
  centerOn: {
    id: 'map.people.center_on',
    defaultMessage: 'Centre the map on {name}',
  },
});

interface PersonProps {
  pin: ApiPresencePinJSON;
  onSelect: (pin: ApiPresencePinJSON) => void;
}

const Person: React.FC<PersonProps> = ({ pin, onSelect }) => {
  const intl = useIntl();
  const handleClick = useCallback(() => {
    onSelect(pin);
  }, [pin, onSelect]);

  const who = pin.self ? intl.formatMessage(messages.you) : pin.name;

  return (
    <button
      type='button'
      className={`map-people__person${pin.self ? ' map-people__person--self' : ''}`}
      onClick={handleClick}
      aria-label={intl.formatMessage(messages.centerOn, { name: who })}
    >
      <span className='map-people__avatar'>
        <img src={pin.avatar} alt='' aria-hidden />
      </span>
      <span className='map-people__label'>
        {pin.self ? intl.formatMessage(messages.you) : `@${pin.handle}`}
      </span>
    </button>
  );
};

interface PeopleStripProps {
  pins: ApiPresencePinJSON[];
  selfPin: ApiPresencePinJSON | null;
  onSelect: (pin: ApiPresencePinJSON) => void;
}

export const PeopleStrip: React.FC<PeopleStripProps> = ({
  pins,
  selfPin,
  onSelect,
}) => {
  const intl = useIntl();

  // Self tile leftmost/topmost, then everyone else (pins already exclude self).
  const ordered = selfPin ? [selfPin, ...pins] : pins;
  if (ordered.length === 0) return null;

  return (
    <div className='map-people' aria-label={intl.formatMessage(messages.label)}>
      <div className='map-people__scroller'>
        {ordered.map((pin) => (
          <Person key={pin.account_id} pin={pin} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
};
