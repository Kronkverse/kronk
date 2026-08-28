import { useEffect } from 'react';

import { useIntl, defineMessages } from 'react-intl';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import { fetchAccount } from 'mastodon/actions/accounts';
import { Icon } from 'mastodon/components/icon';
import { LoadingIndicator } from 'mastodon/components/loading_indicator';
import { ProfileCard } from 'mastodon/features/profile_peek/profile_card';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

// Profile peek — the full-screen popup that wraps a single
// ProfileCard. Opened by any surface via
//   dispatch(openModal({ modalType: 'PROFILE_PEEK', modalProps: { accountId } }))
// The card is always the same visual; only the frame differs.

const messages = defineMessages({
  close: { id: 'profile_peek.close', defaultMessage: 'Close' },
});

export const ProfilePeekModal: React.FC<{
  accountId: string;
  onClose: () => void;
}> = ({ accountId, onClose }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const account = useAppSelector((state) => state.accounts.get(accountId));

  useEffect(() => {
    if (!account) dispatch(fetchAccount(accountId));
  }, [dispatch, accountId, account]);

  return (
    <div className='profile-peek' role='dialog' aria-modal='true'>
      <button
        type='button'
        className='profile-peek__close'
        onClick={onClose}
        aria-label={intl.formatMessage(messages.close)}
      >
        <Icon id='close' icon={CloseIcon} />
      </button>

      {account ? (
        <ProfileCard account={account} onOpen={onClose} />
      ) : (
        <div className='profile-peek__loading'>
          <LoadingIndicator />
        </div>
      )}
    </div>
  );
};
