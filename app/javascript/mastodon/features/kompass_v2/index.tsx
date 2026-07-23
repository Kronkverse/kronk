import { defineMessages, useIntl } from 'react-intl';

import { KornerIframe } from 'mastodon/components/korner_iframe';

// Kompass — unified (Kommons proposal #116969555027300161
// "New Korner: Map — To see where your mates are and share
// activities"). This proposal came in through the Korner Composer;
// its output is a working manifest + this iframe surface. The
// classic KompassStub retires; the manifest gets enforced: true.

const messages = defineMessages({
  title: { id: 'kompass.title', defaultMessage: 'Kompass' },
});

const KompassV2: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  return (
    <KornerIframe
      title={intl.formatMessage(messages.title)}
      src='/kompass-preview.html'
    />
  );
};

// eslint-disable-next-line import/no-default-export
export default KompassV2;
