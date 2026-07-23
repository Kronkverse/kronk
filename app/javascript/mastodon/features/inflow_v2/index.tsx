import { defineMessages, useIntl } from 'react-intl';

import { KornerIframe } from 'mastodon/components/korner_iframe';

// Inflow — Veil (Kommons proposal #116969234825049453 "Inflow View").
// Ships the Kosmic-veil viewer prototype in place of the classic
// InFlow surface. Real observation-data wiring is the follow-up.

const messages = defineMessages({
  title: { id: 'inflow.title', defaultMessage: 'InFlow' },
});

const InflowV2: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  return (
    <KornerIframe
      title={intl.formatMessage(messages.title)}
      src='/inflow-preview.html'
    />
  );
};

// eslint-disable-next-line import/no-default-export
export default InflowV2;
