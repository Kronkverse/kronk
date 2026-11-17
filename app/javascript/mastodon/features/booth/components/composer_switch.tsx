import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import { KornerPill } from 'mastodon/components/korner_pill';

// The ways into the Booth from the Ж menu's composer: upload a recording,
// play live, or share samples. Sits in `<ComposeShell switcher>`.

const messages = defineMessages({
  upload: { id: 'booth.composer.upload', defaultMessage: 'Upload a set' },
  live: { id: 'booth.composer.live', defaultMessage: 'Go live' },
  sample: { id: 'booth.composer.sample', defaultMessage: 'Share samples' },
});

export type ComposerMode = 'upload' | 'live' | 'sample';

export const ComposerSwitch: React.FC<{ mode: ComposerMode }> = ({ mode }) => {
  const intl = useIntl();
  const history = useHistory();

  const toUpload = useCallback(() => {
    history.replace('/hub/booth/composer');
  }, [history]);
  const toLive = useCallback(() => {
    history.replace('/hub/booth/composer/live');
  }, [history]);
  const toSample = useCallback(() => {
    history.replace('/hub/booth/composer/sample');
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
      <KornerPill
        label={intl.formatMessage(messages.sample)}
        active={mode === 'sample'}
        onClick={toSample}
      />
    </>
  );
};
