import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import {
  apiDisconnectKollectionApp,
  apiGetKollectionApps,
} from 'mastodon/api/kollection';
import type { ApiKollectionAppJSON } from 'mastodon/api/kollection';
import { apiGetAnthemosLinks, apiUnlinkAnthemos } from 'mastodon/api/map_live';
import type { ApiAnthemosLinkJSON } from 'mastodon/api/map_live';
import { LoadingState } from 'mastodon/components/loading_state';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';
import {
  SettingsPage,
  SettingsSection,
} from 'mastodon/features/settings/components';
import { useConfirmDialog } from 'mastodon/hooks/useConfirmDialog';

import { knownScopes, scopeMessages } from './scopes';

// /hub/kollection/settings — Kollection's own settings page
// (docs/spaces/kollection.md, Settings; Standard L8 and L12): what is
// connected to your account. The apps you have signed in to with Kronk,
// each with Disconnect, and the Anthemos phones linked to your account,
// each with Unlink (docs/spaces/map.md, Live location). This was the
// Connected apps section of Account & Security until 2026-11-23, which
// now links here.

const messages = defineMessages({
  title: { id: 'kollection.settings.title', defaultMessage: 'Connected apps' },
  intro: {
    id: 'kollection.settings.intro',
    defaultMessage:
      'What is connected to your account: apps you signed in to with Kronk, and Anthemos phones.',
  },
  apps: {
    id: 'kollection.settings.apps',
    defaultMessage: 'Apps you signed in to',
  },
  appsDesc: {
    id: 'kollection.settings.apps_desc',
    defaultMessage:
      'Each can see what is listed under it. Disconnect signs it out of your account.',
  },
  noApps: {
    id: 'kollection.settings.no_apps',
    defaultMessage: 'You aren’t connected to any app.',
  },
  disconnect: {
    id: 'kollection.app.disconnect',
    defaultMessage: 'Disconnect',
  },
  disconnectTitle: {
    id: 'kollection.app.disconnect_title',
    defaultMessage: 'Disconnect {name}?',
  },
  disconnectBody: {
    id: 'kollection.app.disconnect_body',
    defaultMessage:
      'It is signed out of your account and can no longer see anything of it. You can sign in to it again any time.',
  },
  phones: {
    id: 'kollection.settings.phones',
    defaultMessage: 'Anthemos phones',
  },
  phonesDesc: {
    id: 'kollection.settings.phones_desc',
    defaultMessage:
      'Anthemos phones linked to your account. Unlinking one ends any live location it is sharing.',
  },
  noPhones: {
    id: 'kollection.settings.no_phones',
    defaultMessage: 'No Anthemos phone is linked.',
  },
  unlink: { id: 'kollection.settings.unlink', defaultMessage: 'Unlink' },
  unlinkTitle: {
    id: 'kollection.settings.unlink_title',
    defaultMessage: 'Unlink this phone?',
  },
  unlinkMessage: {
    id: 'kollection.settings.unlink_message',
    defaultMessage:
      'It can no longer share with Kronk, and any live location it is sharing stops now. You can link it again from Anthemos.',
  },
});

const KollectionSettings: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const [confirmDialog, confirm] = useConfirmDialog();
  const [apps, setApps] = useState<ApiKollectionAppJSON[] | null>(null);
  const [links, setLinks] = useState<ApiAnthemosLinkJSON[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    void apiGetKollectionApps()
      .then((rows) => {
        if (!cancelled) setApps(rows.filter((row) => row.connected));
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setApps([]);
      });

    void apiGetAnthemosLinks()
      .then((rows) => {
        if (!cancelled) setLinks(rows);
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setLinks([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleDisconnect = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const id = event.currentTarget.dataset.id;
      const name = event.currentTarget.dataset.name ?? '';
      if (!id) return;

      void (async () => {
        const ok = await confirm({
          title: intl.formatMessage(messages.disconnectTitle, { name }),
          message: intl.formatMessage(messages.disconnectBody),
          confirmLabel: intl.formatMessage(messages.disconnect),
          destructive: true,
        });
        if (!ok) return;

        await apiDisconnectKollectionApp(id);
        setApps((rows) => (rows ?? []).filter((row) => row.id !== id));
      })();
    },
    [confirm, intl],
  );

  const handleUnlink = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const id = event.currentTarget.dataset.id;
      if (!id) return;

      void (async () => {
        const ok = await confirm({
          title: intl.formatMessage(messages.unlinkTitle),
          message: intl.formatMessage(messages.unlinkMessage),
          confirmLabel: intl.formatMessage(messages.unlink),
          destructive: true,
        });
        if (!ok) return;

        await apiUnlinkAnthemos(id);
        setLinks((rows) => (rows ?? []).filter((row) => row.id !== id));
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
          title={intl.formatMessage(messages.apps)}
          description={intl.formatMessage(messages.appsDesc)}
        >
          {apps === null ? (
            <LoadingState />
          ) : apps.length === 0 ? (
            <p className='settings-page__row-desc'>
              {intl.formatMessage(messages.noApps)}
            </p>
          ) : (
            apps.map((app) => (
              <div key={app.id} className='settings-page__row'>
                <div className='settings-page__row-body'>
                  <div className='settings-page__row-label'>
                    <Link to={`/hub/kollection/${app.id}`}>{app.name}</Link>
                  </div>
                  <div className='settings-page__row-desc'>
                    {knownScopes(app.scopes)
                      .map((scope) => intl.formatMessage(scopeMessages[scope]))
                      .join('. ')}
                  </div>
                </div>
                <div className='settings-page__row-widget'>
                  <button
                    type='button'
                    className='account-settings__revoke'
                    data-id={app.id}
                    data-name={app.name}
                    onClick={handleDisconnect}
                  >
                    {intl.formatMessage(messages.disconnect)}
                  </button>
                </div>
              </div>
            ))
          )}
        </SettingsSection>

        <SettingsSection
          title={intl.formatMessage(messages.phones)}
          description={intl.formatMessage(messages.phonesDesc)}
        >
          {links === null ? (
            <LoadingState />
          ) : links.length === 0 ? (
            <p className='settings-page__row-desc'>
              {intl.formatMessage(messages.noPhones)}
            </p>
          ) : (
            links.map((link) => (
              <div key={link.id} className='settings-page__row'>
                <div className='settings-page__row-body'>
                  <div className='settings-page__row-label'>
                    {link.device_name} · Anthemos
                  </div>
                  <div className='settings-page__row-desc'>
                    <RelativeTimestamp
                      timestamp={link.last_used_at ?? link.created_at}
                    />
                  </div>
                </div>
                <div className='settings-page__row-widget'>
                  <button
                    type='button'
                    className='account-settings__revoke'
                    data-id={link.id}
                    onClick={handleUnlink}
                  >
                    {intl.formatMessage(messages.unlink)}
                  </button>
                </div>
              </div>
            ))
          )}
        </SettingsSection>
      </SettingsPage>
      {confirmDialog}
    </>
  );
};

// eslint-disable-next-line import/no-default-export
export default KollectionSettings;
