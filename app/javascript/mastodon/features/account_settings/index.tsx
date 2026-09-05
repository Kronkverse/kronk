import { useEffect, useState, useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import {
  fetchSessions,
  fetchLoginActivities,
  revokeSession,
} from 'mastodon/api/account_settings';
import type {
  SessionActivation,
  LoginActivity,
} from 'mastodon/api/account_settings';
import { AllSettingsFooter } from 'mastodon/components/all_settings_footer';
import { LoadingState } from 'mastodon/components/loading_state';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';
import { Stage } from 'mastodon/components/stage';
import { SettingsSpaceHeader } from 'mastodon/features/settings/space_header';
import { useConfirmDialog } from 'mastodon/hooks/useConfirmDialog';

// Account & Security — Kronk-native landing (Phase 1). Renders the two
// mechanical, low-risk surfaces (signed-in devices + recent sign-ins) natively
// and links out to the security-critical Devise flows (change password/email,
// 2FA, move account, delete) that are deliberately NOT re-implemented yet — the
// classic pages are battle-tested; rebuilding them blind is where a bug is
// severe. See docs/rebuild/settings_inventory.md and the Account & Security
// scope. L12: <Stage> + shared .space-header; the Frame supplies the
// "← All settings" badge.

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
  twoFactor: {
    id: 'account_settings.two_factor',
    defaultMessage: 'Two-factor authentication',
  },
  moveAccount: {
    id: 'account_settings.move_account',
    defaultMessage: 'Move to another account',
  },
  deleteAccount: {
    id: 'account_settings.delete_account',
    defaultMessage: 'Delete account',
  },
});

// The security-critical flows that stay on the classic Devise pages until each
// is deliberately rebuilt. Plain full-page anchors — leaving the SPA is
// intentional here.
const MANAGE_LINKS = [
  { key: 'changePassword' as const, href: '/auth/edit' },
  {
    key: 'twoFactor' as const,
    href: '/settings/two_factor_authentication_methods',
  },
  { key: 'moveAccount' as const, href: '/settings/migration' },
  {
    key: 'deleteAccount' as const,
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
    <Stage label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <div className='scrollable account-settings'>
        <SettingsSpaceHeader
          title={intl.formatMessage(messages.title)}
          tagline={intl.formatMessage(messages.intro)}
        />

        {/* Signed-in devices */}
        <section className='account-settings__section'>
          <h2 className='account-settings__heading'>
            {intl.formatMessage(messages.devices)}
          </h2>
          {sessions === null ? (
            <LoadingState />
          ) : (
            <ul className='account-settings__list'>
              {sessions.map((session) => (
                <li key={session.id} className='account-settings__row'>
                  <span className='account-settings__row-main'>
                    <span className='account-settings__row-title'>
                      {session.browser} · {session.platform}
                    </span>
                    <span className='account-settings__row-meta'>
                      {session.ip && <>{session.ip} · </>}
                      <RelativeTimestamp timestamp={session.last_active_at} />
                    </span>
                  </span>
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
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent sign-ins */}
        <section className='account-settings__section'>
          <h2 className='account-settings__heading'>
            {intl.formatMessage(messages.logins)}
          </h2>
          {logins === null ? (
            <LoadingState />
          ) : logins.length === 0 ? (
            <p className='account-settings__empty'>
              {intl.formatMessage(messages.noLogins)}
            </p>
          ) : (
            <ul className='account-settings__list'>
              {logins.map((login) => (
                <li key={login.id} className='account-settings__row'>
                  <span className='account-settings__row-main'>
                    <span className='account-settings__row-title'>
                      {login.browser} · {login.platform}
                    </span>
                    <span className='account-settings__row-meta'>
                      {login.ip && <>{login.ip} · </>}
                      <RelativeTimestamp timestamp={login.created_at} />
                    </span>
                  </span>
                  {login.success === false && (
                    <span className='account-settings__badge account-settings__badge--warn'>
                      {intl.formatMessage(messages.failed)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Manage — link-outs to the classic Devise flows */}
        <section className='account-settings__section'>
          <h2 className='account-settings__heading'>
            {intl.formatMessage(messages.manage)}
          </h2>
          <ul className='account-settings__list'>
            {MANAGE_LINKS.map((link) => (
              <li key={link.key}>
                <a
                  className={
                    link.destructive
                      ? 'account-settings__link account-settings__link--destructive'
                      : 'account-settings__link'
                  }
                  href={link.href}
                >
                  {intl.formatMessage(messages[link.key])}
                  <span
                    className='account-settings__link-chevron'
                    aria-hidden='true'
                  >
                    ›
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <AllSettingsFooter />
      </div>

      {confirmDialog}
    </Stage>
  );
};
