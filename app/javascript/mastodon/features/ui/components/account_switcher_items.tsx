import { useEffect, useState, useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import LogoutIcon from '@/material-icons/400-24px/logout.svg?react';
import {
  fetchSwitcherAccounts,
  switchAccount,
} from 'mastodon/api/account_switcher';
import type { SwitcherAccount } from 'mastodon/api/account_switcher';
import { me } from 'mastodon/initial_state';
import { useAppSelector } from 'mastodon/store';
import { logOut } from 'mastodon/utils/log_out';

// The account switcher body (rendered inside the /me hub's switcher modal): the
// account you're currently signed in as, any OTHER accounts authenticated on
// this browser (tap to switch — a hard reload re-boots the SPA as them), an
// "Add account" action (the normal login screen, full 2FA), and "Log out". The
// account set and all switching happen server-side (Auth::SwitchesController);
// the client only ever sees this non-secret roster.

const messages = defineMessages({
  signedInAs: {
    id: 'account_switcher.signed_in_as',
    defaultMessage: 'Signed in as',
  },
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
  const currentAccount = useAppSelector((state) =>
    me ? state.accounts.get(me) : undefined,
  );

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

  // Other authenticated accounts to switch to (the roster minus the active
  // one). Filter on the server's own `active` flag — NOT `id !== me`: the
  // roster's `id` is a USER id while `me` is an ACCOUNT id, so that comparison
  // never matched and the current account leaked into the switch list as a
  // duplicate row (Tal 2026-08-14).
  const others = accounts.filter((account) => !account.active);

  return (
    <div className='account-switcher'>
      {/* The current account is a compact indicator, not a switch row — it
          answers "who am I signed in as" without looking like a second copy
          of an account also in the list below. Sourced from the Redux store
          so it shows even for sessions that predate the switcher (empty
          server roster). */}
      {currentAccount && (
        <div
          className='account-switcher__current'
          title={`@${currentAccount.acct}`}
        >
          <img
            className='account-switcher__current-avatar'
            src={currentAccount.avatar}
            alt=''
          />
          <span className='account-switcher__current-identity'>
            <span className='account-switcher__current-label'>
              {intl.formatMessage(messages.signedInAs)}
            </span>
            <span className='account-switcher__current-acct'>
              @{currentAccount.acct}
            </span>
          </span>
        </div>
      )}

      <div className='account-switcher__accounts'>
        {others.map((account) => (
          <button
            key={account.id}
            type='button'
            className='account-switcher__account account-switcher__account--switch'
            data-user-id={account.id}
            onClick={handleSwitch}
            title={intl.formatMessage(messages.switch_to, {
              acct: account.acct,
            })}
          >
            <img
              className='account-switcher__avatar'
              src={account.avatar}
              alt=''
            />
            <span className='account-switcher__identity'>
              <span className='account-switcher__name'>
                {account.display_name || account.acct}
              </span>
              <span className='account-switcher__acct'>@{account.acct}</span>
            </span>
          </button>
        ))}
      </div>

      <a
        className='account-switcher__add'
        href='/auth/sign_in?add=1'
        onClick={onNavigate}
      >
        <span className='account-switcher__add-glyph' aria-hidden='true'>
          +
        </span>
        {intl.formatMessage(messages.add)}
      </a>

      <button
        type='button'
        className='account-switcher__logout'
        onClick={handleLogOut}
      >
        <LogoutIcon />
        {intl.formatMessage(messages.logout)}
      </button>
    </div>
  );
};
