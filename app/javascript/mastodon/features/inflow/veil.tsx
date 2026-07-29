import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import { Stage } from 'mastodon/components/stage';

import { VeilScene } from './veil_scene';

// InFlow — the standalone veil page at /hub/inflow. The scene itself (the
// scroll-driven reveal) lives in <VeilScene>, shared with the home feed's veil
// gap; here it's wrapped in a Stage for the Hub tile / direct navigation.

const messages = defineMessages({
  title: { id: 'inflow.title', defaultMessage: 'In Flow' },
});

export const InflowVeil: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>
      <VeilScene />
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default InflowVeil;
