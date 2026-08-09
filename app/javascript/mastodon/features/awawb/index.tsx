import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

// AWAWB — a still page. Reached from the middle pillar of the top
// Membrane (see hub_switcher.tsx); the icon is the Aboriginal flag.
// One line, centred: "Always was, always will be." Nothing else. The
// stillness is the point.

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
      <p className='awawb-page__quote'>
        <FormattedMessage
          id='awawb.quote'
          defaultMessage='Always was, always will be.'
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
