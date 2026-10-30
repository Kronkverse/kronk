import { useCallback, useEffect, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import aboriginalFlag from '@/images/aboriginal-flag.png';

// AWAWB — a still page. Reached from the middle pillar of the top
// Membrane (see hub_switcher.tsx); the icon there is the Aboriginal
// flag glyph. This page places the flag itself in the centre with
// two lines flanking it — "Always was." above, "Always will be."
// below. Nothing else. The stillness is the point.
//
// Each time it opens, Kronk's Acknowledgement of Country comes first: it
// fades in, stays long enough to read, and fades out before the flag
// (Kommons "Update the flag screen", @mangobee, 2026-10-30). Tapping it goes
// straight on. With reduced motion it doesn't fade, it just changes over.
//
// Uses the full tri-colour flag (black/red halves + yellow sun) as
// a static PNG so it renders exactly as designed — no chrome
// currentColor override.

// How long the acknowledgement is on the page, fades included. Matches the
// `awawb-acknowledge` animation in styles/kronk/_awawb.scss.
const ACKNOWLEDGEMENT_MS = 9000;

const messages = defineMessages({
  title: {
    id: 'awawb.title',
    defaultMessage: 'Always was, always will be',
  },
  acknowledgement: {
    id: 'awawb.acknowledgement',
    defaultMessage:
      'KRONK acknowledges the Traditional Owners of Country throughout Australia and recognises their continuing connection to land, waters and community. We pay our respects to Elders past and present.',
  },
});

const Awawb: React.FC = () => {
  const intl = useIntl();
  const [acknowledging, setAcknowledging] = useState(true);

  useEffect(() => {
    if (!acknowledging) return;
    const timer = window.setTimeout(() => {
      setAcknowledging(false);
    }, ACKNOWLEDGEMENT_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [acknowledging]);

  const goOn = useCallback(() => {
    setAcknowledging(false);
  }, []);

  return (
    <div className='awawb-page'>
      {acknowledging ? (
        <button type='button' className='awawb-page__ack' onClick={goOn}>
          {intl.formatMessage(messages.acknowledgement)}
        </button>
      ) : (
        <div className='awawb-page__flag-screen'>
          <p className='awawb-page__line awawb-page__line--top'>
            <FormattedMessage
              id='awawb.line_top'
              defaultMessage='Always was.'
            />
          </p>
          <img
            className='awawb-page__flag'
            src={aboriginalFlag}
            alt={intl.formatMessage(messages.title)}
          />
          <p className='awawb-page__line awawb-page__line--bottom'>
            <FormattedMessage
              id='awawb.line_bottom'
              defaultMessage='Always will be.'
            />
          </p>
        </div>
      )}

      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>
    </div>
  );
};

// eslint-disable-next-line import/no-default-export
export default Awawb;
