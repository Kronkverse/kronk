import { defineMessages, useIntl } from 'react-intl';

import { ProfileCardDeck } from './profile_card_deck';

// Kommunity discover drawer (Tal 2026-08-28). Replaces the flat row
// list. Vertical scroll-snap between layers — one layer per screen;
// horizontal swipe within a layer to page through profile cards.
//
// Layer order (top → bottom): Kronkers (public strangers), Orbit
// (mates of mates), Krews (members of your krews). Mates are
// deliberately absent from the discover drawer — they're not
// discovery. The `/@me/mates` surface remains their home.
//
// Titles above each deck are small (the frame's rotator carries the
// big page title). Under Tal's "no side-scroll on phone" rule the
// deck itself is horizontal snap-scroll — this is the exception the
// rule anticipates (the deck IS the content, not a peek-slice of a
// bigger surface).

const messages = defineMessages({
  kronkers: {
    id: 'kommunity.drawer.kronkers',
    defaultMessage: 'Kronkers',
  },
  orbit: {
    id: 'kommunity.drawer.orbit',
    defaultMessage: 'Orbit',
  },
  krews: {
    id: 'kommunity.drawer.krews',
    defaultMessage: 'Krews',
  },
});

export const KommunityDrawer: React.FC = () => {
  const intl = useIntl();
  return (
    <div className='kommunity-drawer'>
      <ProfileCardDeck
        layer='kronkers'
        title={intl.formatMessage(messages.kronkers)}
      />
      <ProfileCardDeck
        layer='orbit'
        title={intl.formatMessage(messages.orbit)}
      />
      <ProfileCardDeck
        layer='krews'
        title={intl.formatMessage(messages.krews)}
      />
    </div>
  );
};
