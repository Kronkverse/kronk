import { defineMessages, useIntl } from 'react-intl';

import { KornerIframe } from 'mastodon/components/korner_iframe';

// Hub — arrangeable (Kommons proposal #116969310564889092
// "Hub Realignment"). Overwrites alpha.197's code-based Hub with the
// drag-arrangeable prototype. Real port + data wiring is the
// follow-up.

const messages = defineMessages({
  title: { id: 'hub.title', defaultMessage: 'Hub' },
});

const HubArrangeable: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  return (
    <KornerIframe
      title={intl.formatMessage(messages.title)}
      src='/hub-arrangeable-preview.html'
    />
  );
};

// eslint-disable-next-line import/no-default-export
export default HubArrangeable;
