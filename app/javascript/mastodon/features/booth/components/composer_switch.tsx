import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import { KornerPill } from 'mastodon/components/korner_pill';

// The two ways into the Booth from the Ж menu's composer: upload a
// recording, or play live. Sits in `<ComposeShell switcher>`.

const messages = defineMessages({
  upload: { id: 'booth.composer.upload', defaultMessage: 'Upload a set' },
  live: { id: 'booth.composer.live', defaultMessage: 'Go live' },
});

export type ComposerMode = 'upload' | 'live';

export const ComposerSwitch: React.FC<{ mode: ComposerMode }> = ({ mode }) => {
  const intl = useIntl();
  const history = useHistory();

  const toUpload = useCallback(() => {
    history.replace('/hub/booth/composer');
  }, [history]);
  const toLive = useCallback(() => {
    history.replace('/hub/booth/composer/live');
  }, [history]);

  return (
    <>
      <KornerPill
        label={intl.formatMessage(messages.upload)}
        active={mode === 'upload'}
        onClick={toUpload}
      />
      <KornerPill
        label={intl.formatMessage(messages.live)}
        active={mode === 'live'}
        onClick={toLive}
      />
    </>
  );
};
