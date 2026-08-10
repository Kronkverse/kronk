import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import LocationOnIcon from '@/material-icons/400-24px/location_on.svg?react';
import type { ApiPresencePinJSON } from 'mastodon/api/map';
import { Icon } from 'mastodon/components/icon';

// The people strip — a face per pin currently on the map. Tapping one
// centres the map on that person. Vertical rail on desktop, horizontal
// band on phone (see `.map-people` in _map.scss).
//
// Top slot is always the viewer's own "self" slot (Tal 2026-08-10 —
// "remove the pin from the bottom left corner, and instead place it
// at the top of the list of mates"):
//   * no self-pin → LocationOn icon; click opens the place-a-pin panel.
//   * self-pin exists → the viewer's avatar; click centres the map on
//     it, plus a small × badge to remove.
// The strip therefore always renders — even when the viewer has no
// pin and there are no mates on the map, so a signed-in visitor
// still has a place-me affordance.

const messages = defineMessages({
  label: { id: 'map.people.label', defaultMessage: 'People on the map' },
  you: { id: 'map.people.you', defaultMessage: 'You' },
  centerOn: {
    id: 'map.people.center_on',
    defaultMessage: 'Centre the map on {name}',
  },
  placeMe: {
    id: 'map.people.place_me',
    defaultMessage: 'Place me on the map',
  },
  removeMe: {
    id: 'map.people.remove_me',
    defaultMessage: 'Remove me from the map',
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

  return (
    <button
      type='button'
      className='map-people__person'
      onClick={handleClick}
      aria-label={intl.formatMessage(messages.centerOn, { name: pin.name })}
    >
      <span className='map-people__avatar'>
        <img src={pin.avatar} alt='' aria-hidden />
      </span>
      <span className='map-people__label'>@{pin.handle}</span>
    </button>
  );
};

interface SelfSlotProps {
  selfPin: ApiPresencePinJSON | null;
  onOpenPlace: () => void;
  onRemove: () => void;
  onSelect: (pin: ApiPresencePinJSON) => void;
}

// The self-slot at the top of the strip. Two visual states — see the
// component comment above.
const SelfSlot: React.FC<SelfSlotProps> = ({
  selfPin,
  onOpenPlace,
  onRemove,
  onSelect,
}) => {
  const intl = useIntl();
  const handleCenterSelf = useCallback(() => {
    if (selfPin) onSelect(selfPin);
  }, [selfPin, onSelect]);

  if (!selfPin) {
    return (
      <div className='map-people__self'>
        <button
          type='button'
          className='map-people__self-place'
          onClick={onOpenPlace}
          aria-label={intl.formatMessage(messages.placeMe)}
          title={intl.formatMessage(messages.placeMe)}
        >
          <Icon id='location-on' icon={LocationOnIcon} />
        </button>
        <span className='map-people__label'>
          {intl.formatMessage(messages.you)}
        </span>
      </div>
    );
  }

  return (
    <div className='map-people__self'>
      <button
        type='button'
        className='map-people__person map-people__person--self'
        onClick={handleCenterSelf}
        aria-label={intl.formatMessage(messages.centerOn, {
          name: intl.formatMessage(messages.you),
        })}
      >
        <span className='map-people__avatar'>
          <img src={selfPin.avatar} alt='' aria-hidden />
        </span>
        <span className='map-people__label'>
          {intl.formatMessage(messages.you)}
        </span>
      </button>
      <button
        type='button'
        className='map-people__self-remove'
        onClick={onRemove}
        aria-label={intl.formatMessage(messages.removeMe)}
        title={intl.formatMessage(messages.removeMe)}
      >
        <Icon id='close' icon={CloseIcon} />
      </button>
    </div>
  );
};

interface PeopleStripProps {
  pins: ApiPresencePinJSON[];
  selfPin: ApiPresencePinJSON | null;
  onSelect: (pin: ApiPresencePinJSON) => void;
  onOpenPlace: () => void;
  onRemoveSelf: () => void;
}

export const PeopleStrip: React.FC<PeopleStripProps> = ({
  pins,
  selfPin,
  onSelect,
  onOpenPlace,
  onRemoveSelf,
}) => {
  const intl = useIntl();
  // `pins` from the API already excludes the viewer (PresenceController
  // strips `current_account.id`), so the mate list is just `pins`.
  return (
    <div className='map-people' aria-label={intl.formatMessage(messages.label)}>
      <div className='map-people__scroller'>
        <SelfSlot
          selfPin={selfPin}
          onOpenPlace={onOpenPlace}
          onRemove={onRemoveSelf}
          onSelect={onSelect}
        />
        {pins.map((pin) => (
          <Person key={pin.account_id} pin={pin} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
};
