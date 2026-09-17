import { defineMessages, useIntl } from 'react-intl';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import { Icon } from 'mastodon/components/icon';

// The "Draft restored · Discard" pill shown by a composer when
// useComposerDraft repopulated it from a saved draft. Discard clears the
// stored draft and (via the composer's handler) resets the composer.
const messages = defineMessages({
  restored: { id: 'compose.draft_restored', defaultMessage: 'Draft restored' },
  discard: { id: 'compose.draft_discard', defaultMessage: 'Discard' },
});

export const DraftRestoredPill: React.FC<{ onDiscard: () => void }> = ({
  onDiscard,
}) => {
  const intl = useIntl();

  return (
    <div className='draft-restored-pill' role='status'>
      <span className='draft-restored-pill__label'>
        {intl.formatMessage(messages.restored)}
      </span>
      <button
        type='button'
        className='draft-restored-pill__discard'
        onClick={onDiscard}
      >
        {intl.formatMessage(messages.discard)}
        <Icon id='close' icon={CloseIcon} />
      </button>
    </div>
  );
};
