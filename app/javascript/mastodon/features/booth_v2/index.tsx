import { defineMessages, useIntl } from 'react-intl';

import { KornerIframe } from 'mastodon/components/korner_iframe';

// Booth — v2 (Kommons proposal #116961575489866616 "Booth Rebuild").
// Ships the redesigned Booth prototype in place of the classic
// Booth surface. Booth-set detail pages (/hub/booth/sets/:id) still
// use the existing BoothSetPage until the redesign covers detail too.

const messages = defineMessages({
  title: { id: 'booth.title', defaultMessage: 'Booth' },
});

const BoothV2: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  return (
    <KornerIframe
      title={intl.formatMessage(messages.title)}
      src='/booth-preview.html'
    />
  );
};

// eslint-disable-next-line import/no-default-export
export default BoothV2;
