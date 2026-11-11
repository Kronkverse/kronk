import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import { Icon } from 'mastodon/components/icon';

const messages = defineMessages({
  remove: {
    id: 'albutts.composer.remove_photo',
    defaultMessage: 'Remove photo',
  },
});

// The little × in the corner of a picked photo, opposite its upload chip
// (docs/spaces/albutts.md, Arranging a new album; Tal, 2026-11-11). Takes
// the one photo out before it's added to the album.
export const PickRemove: React.FC<{
  photoKey: string;
  onRemove: (key: string) => void;
}> = ({ photoKey, onRemove }) => {
  const intl = useIntl();
  const handleClick = useCallback(() => {
    onRemove(photoKey);
  }, [onRemove, photoKey]);
  const label = intl.formatMessage(messages.remove);

  return (
    <button
      type='button'
      className='albutts-composer__pick-remove'
      onClick={handleClick}
      aria-label={label}
      title={label}
    >
      <Icon id='close' icon={CloseIcon} aria-hidden />
    </button>
  );
};
