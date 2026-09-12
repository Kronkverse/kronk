import { useEffect, useState, useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import {
  fetchSessions,
  fetchLoginActivities,
  revokeSession,
} from 'mastodon/api/account_settings';
import type {
  SessionActivation,
  LoginActivity,
} from 'mastodon/api/account_settings';
import { LoadingState } from 'mastodon/components/loading_state';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';
import {
  SettingsPage,
  SettingsSection,
  SettingsActionRow,
} from 'mastodon/features/settings/components';
import { useConfirmDialog } from 'mastodon/hooks/useConfirmDialog';

// Account & Security. Kronk-native listings for the mechanical, low-
// risk surfaces (signed-in devices + recent sign-ins); links out to
// the security-critical Devise flows (change password/email, 2FA,
// move, delete) that are deliberately NOT re-implemented — the
// classic pages are battle-tested and rebuilding them blind is where
// a bug is severe.

const messages = defineMessages({
  title: { id: 'account_settings.title', defaultMessage: 'Account & Security' },
  intro: {
    id: 'account_settings.intro',
    defaultMessage:
      'Your signed-in devices, recent sign-ins, and account controls.',
  },
  devices: {
    id: 'account_settings.devices',
    defaultMessage: 'Signed-in devices',
  },
  devicesDesc: {
    id: 'account_settings.devices_desc',
    defaultMessage: 'Everywhere your account is currently signed in.',
  },
  thisDevice: {
    id: 'account_settings.this_device',
    defaultMessage: 'This device',
  },
  revoke: { id: 'account_settings.revoke', defaultMessage: 'Revoke' },
  revokeTitle: {
    id: 'account_settings.revoke_title',
    defaultMessage: 'Sign this device out?',
  },
  revokeMessage: {
    id: 'account_settings.revoke_message',
    defaultMessage:
      'That device will be signed out of your account. If it was you, you can sign back in any time.',
  },
  logins: { id: 'account_settings.logins', defaultMessage: 'Recent sign-ins' },
  loginsDesc: {
    id: 'account_settings.logins_desc',
    defaultMessage: 'The last few sign-in attempts on your account.',
  },
  noLogins: {
    id: 'account_settings.no_logins',
    defaultMessage: 'No recent sign-ins recorded.',
  },
  failed: { id: 'account_settings.login_failed', defaultMessage: 'Failed' },
  manage: { id: 'account_settings.manage', defaultMessage: 'Manage' },
  changePassword: {
    id: 'account_settings.change_password',
    defaultMessage: 'Change email or password',
  },
  changePasswordDesc: {
    id: 'account_settings.change_password_desc',
    defaultMessage: 'Update your sign-in credentials.',
  },
  twoFactor: {
    id: 'account_settings.two_factor',
    defaultMessage: 'Two-factor authentication',
  },
  twoFactorDesc: {
    id: 'account_settings.two_factor_desc',
    defaultMessage: 'Add a second step to your sign-in.',
  },
  moveAccount: {
    id: 'account_settings.move_account',
    defaultMessage: 'Move to another account',
  },
  moveAccountDesc: {
    id: 'account_settings.move_account_desc',
    defaultMessage: 'Redirect this account and take your followers with you.',
  },
  deleteAccount: {
    id: 'account_settings.delete_account',
    defaultMessage: 'Delete account',
  },
  deleteAccountDesc: {
    id: 'account_settings.delete_account_desc',
    defaultMessage: 'Permanent, irreversible.',
  },
});

// The security-critical flows that stay on the classic Devise pages
// until each is deliberately rebuilt. Plain full-page anchors —
// leaving the SPA is intentional here.
const MANAGE_LINKS = [
  {
    labelMsg: messages.changePassword,
    descMsg: messages.changePasswordDesc,
    href: '/auth/edit',
  },
  {
    labelMsg: messages.twoFactor,
    descMsg: messages.twoFactorDesc,
    href: '/settings/two_factor_authentication_methods',
  },
  {
    labelMsg: messages.moveAccount,
    descMsg: messages.moveAccountDesc,
    href: '/settings/migration',
  },
  {
    labelMsg: messages.deleteAccount,
    descMsg: messages.deleteAccountDesc,
    href: '/settings/delete',
    destructive: true,
  },
];

export const AccountSettings: React.FC = () => {
  const intl = useIntl();
  const [confirmDialog, confirm] = useConfirmDialog();
  const [sessions, setSessions] = useState<SessionActivation[] | null>(null);
  const [logins, setLogins] = useState<LoginActivity[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetchSessions()
      .then((rows) => {
        if (!cancelled) setSessions(rows);
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      });

    void fetchLoginActivities()
      .then((rows) => {
        if (!cancelled) setLogins(rows);
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setLogins([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleRevoke = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const id = event.currentTarget.dataset.id;
      if (!id) return;

      void (async () => {
        const ok = await confirm({
          title: intl.formatMessage(messages.revokeTitle),
          message: intl.formatMessage(messages.revokeMessage),
          confirmLabel: intl.formatMessage(messages.revoke),
          destructive: true,
        });
        if (!ok) return;

        await revokeSession(id);
        setSessions((rows) => (rows ?? []).filter((row) => row.id !== id));
      })();
    },
    [confirm, intl],
  );

  return (
    <>
      <SettingsPage
        title={intl.formatMessage(messages.title)}
        tagline={intl.formatMessage(messages.intro)}
      >
        <SettingsSection
          title={intl.formatMessage(messages.devices)}
          description={intl.formatMessage(messages.devicesDesc)}
        >
          {sessions === null ? (
            <LoadingState />
          ) : (
            sessions.map((session) => (
              <div key={session.id} className='settings-page__row'>
                <div className='settings-page__row-body'>
                  <div className='settings-page__row-label'>
                    {session.browser} · {session.platform}
                  </div>
                  <div className='settings-page__row-desc'>
                    {session.ip && <>{session.ip} · </>}
                    <RelativeTimestamp timestamp={session.last_active_at} />
                  </div>
                </div>
                <div className='settings-page__row-widget'>
                  {session.current ? (
                    <span className='account-settings__badge'>
                      {intl.formatMessage(messages.thisDevice)}
                    </span>
                  ) : (
                    <button
                      type='button'
                      className='account-settings__revoke'
                      data-id={session.id}
                      onClick={handleRevoke}
                    >
                      {intl.formatMessage(messages.revoke)}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </SettingsSection>

        <SettingsSection
          title={intl.formatMessage(messages.logins)}
          description={intl.formatMessage(messages.loginsDesc)}
        >
          {logins === null ? (
            <LoadingState />
          ) : logins.length === 0 ? (
            <p className='settings-page__row-desc'>
              {intl.formatMessage(messages.noLogins)}
            </p>
          ) : (
            logins.map((login) => (
              <div key={login.id} className='settings-page__row'>
                <div className='settings-page__row-body'>
                  <div className='settings-page__row-label'>
                    {login.browser} · {login.platform}
                  </div>
                  <div className='settings-page__row-desc'>
                    {login.ip && <>{login.ip} · </>}
                    <RelativeTimestamp timestamp={login.created_at} />
                  </div>
                </div>
                {login.success === false && (
                  <div className='settings-page__row-widget'>
                    <span className='account-settings__badge account-settings__badge--warn'>
                      {intl.formatMessage(messages.failed)}
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </SettingsSection>

        <SettingsSection title={intl.formatMessage(messages.manage)}>
          {MANAGE_LINKS.map((link) => (
            <SettingsActionRow
              key={link.href}
              href={link.href}
              label={intl.formatMessage(link.labelMsg)}
              description={intl.formatMessage(link.descMsg)}
              destructive={link.destructive}
            />
          ))}
        </SettingsSection>
      </SettingsPage>
      {confirmDialog}
    </>
  );
};
