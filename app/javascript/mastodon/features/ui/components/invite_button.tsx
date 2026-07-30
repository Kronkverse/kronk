import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import PersonAddIcon from '@/material-icons/400-24px/person_add-fill.svg?react';
import { openModal } from 'mastodon/actions/modal';
import { Icon } from 'mastodon/components/icon';
import { useAppDispatch } from 'mastodon/store';

// Invite button — pinned to the top-right of the KronkFrame TopBand
// grid (column 3). Opens the existing InviteModal (QR + shareable link)
// wired through the `'INVITE'` entry in MODAL_COMPONENTS. Kept as its
// own component so KronkFrame slot children stay small + declarative.
//
// Deliberately styled to stand out — solid Kronk-purple pill with a
// glow. The whole point of the surface is "invite people you know",
// which is one of the actions Kronk wants to be discoverable.

const messages = defineMessages({
  invite: {
    id: 'kronk_frame.invite',
    defaultMessage: 'Invite someone to Kronk',
  },
});

export const InviteButton: React.FC = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();

  const handleClick = useCallback(() => {
    dispatch(openModal({ modalType: 'INVITE', modalProps: {} }));
  }, [dispatch]);

  const label = intl.formatMessage(messages.invite);

  return (
    <button
      type='button'
      className='kronk-invite-button'
      onClick={handleClick}
      aria-label={label}
      title={label}
    >
      <Icon
        id='person_add'
        icon={PersonAddIcon}
        className='kronk-invite-button__icon'
      />
    </button>
  );
};
