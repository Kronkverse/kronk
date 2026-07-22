import { FormattedMessage } from 'react-intl';

// Settings panel scaffold — Phase 2a. Visibility dial + toggles land
// in Phase 2g.
export const SettingsPanel: React.FC = () => (
  <section className='kuestions-panel'>
    <h1 className='kuestions-wordmark'>Settings</h1>
    <p className='kuestions-sub'>
      <FormattedMessage
        id='kuestions.settings.subtitle'
        defaultMessage='How much of the Q&A reaches you.'
      />
    </p>
    <p className='kuestions-panel__placeholder'>
      <FormattedMessage
        id='kuestions.settings.placeholder'
        defaultMessage='Kuestions settings (visibility default, daily prompt, hide answered, confirm) land next.'
      />
    </p>
  </section>
);
