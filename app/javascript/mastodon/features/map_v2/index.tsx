import { defineMessages, useIntl } from 'react-intl';

import { KornerIframe } from 'mastodon/components/korner_iframe';

// Map — unified (Kommons proposal #116969555027300161
// "New Korner: Map — To see where your mates are and share
// activities"). This proposal came in through the Korner Composer;
// its output is a working manifest + this iframe surface. The
// classic MapStub retires; the manifest gets enforced: true.

const messages = defineMessages({
  title: { id: 'map.title', defaultMessage: 'Map' },
});

const MapV2: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  return (
    <KornerIframe
      title={intl.formatMessage(messages.title)}
      src='/map-preview.html'
    />
  );
};

// eslint-disable-next-line import/no-default-export
export default MapV2;
