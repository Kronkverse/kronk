import { useCallback } from 'react';

import { FormattedMessage } from 'react-intl';

interface AskPanelProps {
  onDone: () => void;
}

// Ask panel scaffold — Phase 2a. Two-stage compose flow (text →
// format picker) lands in Phase 2e.
export const AskPanel: React.FC<AskPanelProps> = ({ onDone }) => {
  const handleBack = useCallback(() => {
    onDone();
  }, [onDone]);

  return (
    <section className='kuestions-panel'>
      <h1 className='kuestions-wordmark'>Ask</h1>
      <p className='kuestions-sub'>
        <FormattedMessage
          id='kuestions.ask.subtitle'
          defaultMessage="Nobody sees answers until they've given one."
        />
      </p>
      <p className='kuestions-panel__placeholder'>
        <FormattedMessage
          id='kuestions.ask.placeholder'
          defaultMessage='Ask composer coming next.'
        />
      </p>
      <button
        type='button'
        className='kuestions-btn kuestions-btn--ghost'
        onClick={handleBack}
      >
        <FormattedMessage
          id='kuestions.ask.back_to_deck'
          defaultMessage='Back to deck'
        />
      </button>
    </section>
  );
};
