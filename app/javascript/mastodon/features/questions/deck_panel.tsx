import { FormattedMessage } from 'react-intl';

// Deck panel scaffold — Phase 2a. The real swipe deck lands in Phase 2b.
export const DeckPanel: React.FC = () => (
  <section className='kuestions-panel'>
    <h1 className='kuestions-wordmark'>Ƙuestions</h1>
    <p className='kuestions-sub'>
      <FormattedMessage
        id='kuestions.deck.subtitle'
        defaultMessage='Answer to unlock.'
      />
    </p>
    <p className='kuestions-panel__placeholder'>
      <FormattedMessage
        id='kuestions.deck.placeholder'
        defaultMessage='The swipe deck lands next. Deck fetch + gestures + answer sheet.'
      />
    </p>
  </section>
);
