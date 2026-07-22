import { useCallback } from 'react';

import { FormattedMessage } from 'react-intl';

interface AnsweredPanelProps {
  onGoDeck: () => void;
}

// Answered panel scaffold — Phase 2a. The unlocked-Kuestions list
// (with reveal-on-tap) lands in Phase 2d.
export const AnsweredPanel: React.FC<AnsweredPanelProps> = ({ onGoDeck }) => {
  const handleClick = useCallback(() => {
    onGoDeck();
  }, [onGoDeck]);

  return (
    <section className='kuestions-panel'>
      <h1 className='kuestions-wordmark'>Answered</h1>
      <p className='kuestions-sub'>
        <FormattedMessage
          id='kuestions.answered.subtitle'
          defaultMessage='Unlocked by you. These stay open.'
        />
      </p>
      <div className='kuestions-empty'>
        <h3>
          <FormattedMessage
            id='kuestions.answered.empty_title'
            defaultMessage='Nothing unlocked yet'
          />
        </h3>
        <p>
          <FormattedMessage
            id='kuestions.answered.empty_body'
            defaultMessage='Answer a kuestion and it lands here, open for good.'
          />
        </p>
        <button type='button' className='kuestions-btn' onClick={handleClick}>
          <FormattedMessage
            id='kuestions.answered.open_deck'
            defaultMessage='Open the deck'
          />
        </button>
      </div>
    </section>
  );
};
