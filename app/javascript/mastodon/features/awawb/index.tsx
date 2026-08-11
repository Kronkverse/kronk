import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import AboriginalFlagIcon from '@/material-icons/400-24px/aboriginal_flag.svg?react';

// AWAWB — a still page. Reached from the middle pillar of the top
// Membrane (see hub_switcher.tsx); the icon there is the Aboriginal
// flag glyph. This page places the flag itself in the centre with
// two lines flanking it — "Always was." above, "Always will be."
// below. Nothing else. The stillness is the point.

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
      <AboriginalFlagIcon
        className='awawb-page__flag'
        role='img'
        aria-label={intl.formatMessage(messages.title)}
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
