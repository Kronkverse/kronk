import { defineMessages, useIntl } from 'react-intl';

import { KornerIframe } from 'mastodon/components/korner_iframe';

// Wachuneed — v2 (Kommons proposal #116969290056915744
// "Wachuneed Rebuild"). Ships the redesigned Wachuneed prototype in
// place of the classic surface. Listing detail + composer still
// use the existing code until the redesign covers those flows.

const messages = defineMessages({
  title: { id: 'wachuneed.title', defaultMessage: 'Wachuneed' },
});

const WachuneedV2: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  return (
    <KornerIframe
      title={intl.formatMessage(messages.title)}
      src='/wachuneed-preview.html'
    />
  );
};

// eslint-disable-next-line import/no-default-export
export default WachuneedV2;
