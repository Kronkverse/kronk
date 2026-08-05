import { defineMessages, useIntl } from 'react-intl';

import { AccountSwitcherItems } from './account_switcher_items';

// The account switcher, opened from the 'Switch Account' spoke on the /me hub.
// The roster + all switching/adding/logging-out live in AccountSwitcherItems;
// this modal is just the frame. Passing onClose as onNavigate means a switch,
// add, or log-out dismisses the modal (before the hard reload takes over).

const messages = defineMessages({
  title: { id: 'account_switcher.title', defaultMessage: 'Switch account' },
  close: { id: 'account_switcher.close', defaultMessage: 'Close' },
});

interface AccountSwitcherModalProps {
  onClose: () => void;
}

const AccountSwitcherModal: React.FC<AccountSwitcherModalProps> = ({
  onClose,
}) => {
  const intl = useIntl();

  return (
    <div className='modal-root__modal safety-action-modal account-switcher-modal'>
      <div className='safety-action-modal__top'>
        <div className='safety-action-modal__confirmation'>
          <h1>{intl.formatMessage(messages.title)}</h1>
        </div>

        <div className='account-switcher-modal__body'>
          <AccountSwitcherItems onNavigate={onClose} />
        </div>
      </div>

      <div className='safety-action-modal__bottom'>
        <div className='safety-action-modal__actions'>
          <button onClick={onClose} className='link-button'>
            {intl.formatMessage(messages.close)}
          </button>
        </div>
      </div>
    </div>
  );
};

// eslint-disable-next-line import/no-default-export
export default AccountSwitcherModal;
