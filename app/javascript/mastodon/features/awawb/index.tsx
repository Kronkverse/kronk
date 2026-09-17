import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import aboriginalFlag from '@/images/aboriginal-flag.png';

// AWAWB — a still page. Reached from the middle pillar of the top
// Membrane (see hub_switcher.tsx); the icon there is the Aboriginal
// flag glyph. This page places the flag itself in the centre with
// two lines flanking it — "Always was." above, "Always will be."
// below. Nothing else. The stillness is the point.
//
// Uses the full tri-colour flag (black/red halves + yellow sun) as
// a static PNG so it renders exactly as designed — no chrome
// currentColor override.

const messages = defineMessages({
  title: {
    id: 'awawb.title',
    defaultMessage: 'Always was, always will be',
  },
});

const Awawb: React.FC = () => {
  const intl = useIntl();

  return (
    <div className='awawb-page'>
      <p className='awawb-page__line awawb-page__line--top'>
        <FormattedMessage id='awawb.line_top' defaultMessage='Always was.' />
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

      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>
    </div>
  );
};

// eslint-disable-next-line import/no-default-export
export default Awawb;
