import { FormattedMessage } from 'react-intl';

// Today panel scaffold — Phase 2a. Daily prompt fetch + Murmur
// post-box integration lands in Phase 2f.
export const TodayPanel: React.FC = () => (
  <section className='kuestions-panel'>
    <h1 className='kuestions-wordmark'>Today</h1>
    <p className='kuestions-sub'>
      <FormattedMessage
        id='kuestions.today.subtitle'
        defaultMessage='One prompt from Kronk. Same for everyone.'
      />
    </p>
    <p className='kuestions-panel__placeholder'>
      <FormattedMessage
        id='kuestions.today.placeholder'
        defaultMessage="Today's prompt appears here."
      />
    </p>
  </section>
);
