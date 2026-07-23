import { defineMessages, useIntl } from 'react-intl';

import { KornerIframe } from 'mastodon/components/korner_iframe';

// The Kalendar (Kalendar Rebuild — Kommons proposal #116969253949249128).
// The Spiral IS the Kalendar; the classic Events list retired in
// alpha.201. Individual /hub/kalendar/:id detail pages remain
// (EventDetail) until the Spiral wires day-picking to them.

const messages = defineMessages({
  title: { id: 'kalendar_spiral.title', defaultMessage: '₭alendar' },
});

const KalendarSpiral: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  return (
    <KornerIframe
      title={intl.formatMessage(messages.title)}
      src='/kalendar-spiral-preview.html'
    />
  );
};

// eslint-disable-next-line import/no-default-export
export default KalendarSpiral;
