import { useEffect, useState, useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import {
  fetchSwitcherAccounts,
  switchAccount,
} from 'mastodon/api/account_switcher';
import type { SwitcherAccount } from 'mastodon/api/account_switcher';
import { logOut } from 'mastodon/utils/log_out';

// The account-switcher rows rendered inside the Ж menu panel: any OTHER
// accounts signed in on this browser (tap to switch — a hard reload re-boots
// the SPA as that account), an "Add account" entry (the normal login screen,
// full 2FA), and "Log out". The set of accounts and all switching happen
// server-side (Auth::SwitchesController); the client only ever sees this
// non-secret roster.

const messages = defineMessages({
  add: { id: 'account_switcher.add', defaultMessage: 'Add account' },
  logout: { id: 'account_switcher.logout', defaultMessage: 'Log out' },
  switch_to: {
    id: 'account_switcher.switch_to',
    defaultMessage: 'Switch to @{acct}',
  },
});

interface Props {
  onNavigate?: () => void;
}

export const AccountSwitcherItems: React.FC<Props> = ({ onNavigate }) => {
  const intl = useIntl();
  const [accounts, setAccounts] = useState<SwitcherAccount[]>([]);

  useEffect(() => {
    let cancelled = false;

    void fetchSwitcherAccounts()
      .then((rows) => {
        if (!cancelled) setAccounts(rows);
        return undefined;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSwitch = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const userId = event.currentTarget.dataset.userId;
      if (!userId) return;

      void switchAccount(userId)
        .then((redirect) => {
          if (redirect) window.location.href = redirect;
          return undefined;
        })
        .catch(() => undefined);
    },
    [],
  );

  const handleLogOut = useCallback(() => {
    void logOut();
  }, []);

  const others = accounts.filter((account) => !account.active);

  return (
    <div className='kronk-menu__section' role='group'>
      {others.map((account) => (
        <button
          key={account.id}
          type='button'
          className='kronk-menu__item'
          role='menuitem'
          data-user-id={account.id}
          onClick={handleSwitch}
        >
          <span className='kronk-menu__item-glyph' aria-hidden='true'>
            <img
              className='kronk-menu__item-avatar'
              src={account.avatar}
              alt=''
            />
          </span>
          <span className='kronk-menu__item-label'>
            {intl.formatMessage(messages.switch_to, { acct: account.acct })}
          </span>
        </button>
      ))}

      <a
        className='kronk-menu__item'
        href='/auth/sign_in?add=1'
        role='menuitem'
        onClick={onNavigate}
      >
        <span className='kronk-menu__item-label'>
          {intl.formatMessage(messages.add)}
        </span>
      </a>

      <button
        type='button'
        className='kronk-menu__item'
        role='menuitem'
        onClick={handleLogOut}
      >
        <span className='kronk-menu__item-label'>
          {intl.formatMessage(messages.logout)}
        </span>
      </button>
    </div>
  );
};
