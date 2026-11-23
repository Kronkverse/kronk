import { useCallback, useEffect, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { useHistory, useLocation, useParams } from 'react-router-dom';

import {
  apiDisconnectKollectionApp,
  apiGetKollectionApp,
  apiRemoveKollectionApp,
} from 'mastodon/api/kollection';
import type { ApiKollectionAppJSON } from 'mastodon/api/kollection';
import { EmptyState } from 'mastodon/components/empty_state';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerDetail } from 'mastodon/components/korner_detail';
import { KornerMeta } from 'mastodon/components/korner_meta';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LoadingState } from 'mastodon/components/loading_state';
import { Stage } from 'mastodon/components/stage';
import { useConfirmDialog } from 'mastodon/hooks/useConfirmDialog';

import { AppComposer } from './app_composer';
import { knownScopes, scopeMessages } from './scopes';

// One app in Kollection (docs/spaces/kollection.md), at
// /hub/kollection/:id. <Stage> + <KornerDetail>: its name, what it is,
// who keeps it, and whether you are connected, with Open, Disconnect and,
// for its keeper and admins, Edit and Remove. The body says what it can
// see of you, in plain words. Its keeper and admins also see what Sign in
// with Kronk needs: the client key and secret and the redirect URIs.
// /hub/kollection/:id/edit opens the composer over it. No Konnected block:
// Kollection takes no Konnections (manifest `no_attachments`).

const messages = defineMessages({
  back: { id: 'kollection.title', defaultMessage: 'Kollection' },
  loading: { id: 'kollection.app.loading', defaultMessage: 'Loading app…' },
  missing: {
    id: 'kollection.app.missing',
    defaultMessage: 'This app isn’t in Kollection.',
  },
  keptBy: { id: 'kollection.app.kept_by', defaultMessage: 'Kept by @{acct}' },
  noKeeper: { id: 'kollection.app.no_keeper', defaultMessage: 'No keeper' },
  signsIn: {
    id: 'kollection.card.signs_in',
    defaultMessage: 'Sign in with Kronk',
  },
  link: { id: 'kollection.card.link', defaultMessage: 'A link' },
  connected: { id: 'kollection.card.connected', defaultMessage: 'Connected' },
  notConnected: {
    id: 'kollection.app.not_connected',
    defaultMessage: 'Not connected',
  },
  pulled: {
    id: 'kollection.app.pulled',
    defaultMessage:
      'Pulled by an admin: it is off the list and can’t sign anyone in.',
  },
  open: { id: 'kollection.app.open', defaultMessage: 'Open' },
  disconnect: { id: 'kollection.app.disconnect', defaultMessage: 'Disconnect' },
  disconnectTitle: {
    id: 'kollection.app.disconnect_title',
    defaultMessage: 'Disconnect {name}?',
  },
  disconnectBody: {
    id: 'kollection.app.disconnect_body',
    defaultMessage:
      'It is signed out of your account and can no longer see anything of it. You can sign in to it again any time.',
  },
  edit: { id: 'kollection.app.edit', defaultMessage: 'Edit' },
  remove: { id: 'kollection.app.remove', defaultMessage: 'Remove' },
  removeTitle: {
    id: 'kollection.app.remove_title',
    defaultMessage: 'Remove {name}?',
  },
  removeBody: {
    id: 'kollection.app.remove_body',
    defaultMessage:
      'It leaves Kollection, everyone connected to it is signed out of it, and its keys stop working. This can’t be undone.',
  },
  error: {
    id: 'kollection.app.error',
    defaultMessage: 'That didn’t work. Try again?',
  },
  seesTitle: {
    id: 'kollection.app.sees_title',
    defaultMessage: 'What it can see of you',
  },
  seesLink: {
    id: 'kollection.app.sees_link',
    defaultMessage:
      'Nothing through Kronk. It has its own sign-in, and Kronk shares nothing with it.',
  },
  keysTitle: {
    id: 'kollection.app.keys_title',
    defaultMessage: 'Sign in with Kronk',
  },
  keysHint: {
    id: 'kollection.app.keys_hint',
    defaultMessage:
      'Only its keeper and the admins see these. Keep the secret out of anything public.',
  },
  clientId: { id: 'kollection.app.client_id', defaultMessage: 'Client key' },
  clientSecret: {
    id: 'kollection.app.client_secret',
    defaultMessage: 'Client secret',
  },
  redirects: {
    id: 'kollection.app.redirects',
    defaultMessage: 'Redirect URIs',
  },
  discovery: {
    id: 'kollection.app.discovery',
    defaultMessage: 'OpenID configuration',
  },
});

export const KollectionAppPage: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const history = useHistory();
  const { pathname } = useLocation();
  const { id } = useParams<{ id: string }>();
  const editing = pathname.endsWith('/edit');
  const [confirmDialog, confirm] = useConfirmDialog();

  const [app, setApp] = useState<ApiKollectionAppJSON | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setApp(null);
    setMissing(false);
    apiGetKollectionApp(id)
      .then((row) => {
        if (!cancelled) setApp(row);
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const errorText = intl.formatMessage(messages.error);

  const handleOpen = useCallback(() => {
    if (app?.website) window.open(app.website, '_blank', 'noopener');
  }, [app]);

  const handleDisconnect = useCallback(() => {
    if (!app) return;
    void (async () => {
      const ok = await confirm({
        title: intl.formatMessage(messages.disconnectTitle, { name: app.name }),
        message: intl.formatMessage(messages.disconnectBody),
        confirmLabel: intl.formatMessage(messages.disconnect),
        destructive: true,
      });
      if (!ok) return;
      setBusy(true);
      setError(null);
      try {
        setApp(await apiDisconnectKollectionApp(app.id));
      } catch {
        setError(errorText);
      } finally {
        setBusy(false);
      }
    })();
  }, [app, confirm, intl, errorText]);

  const handleEdit = useCallback(() => {
    history.push({ pathname: `/hub/kollection/${id}/edit` });
  }, [history, id]);

  const handleEditCancel = useCallback(() => {
    history.push({ pathname: `/hub/kollection/${id}` });
  }, [history, id]);

  const handleSaved = useCallback(
    (saved: ApiKollectionAppJSON) => {
      setApp(saved);
      history.push({ pathname: `/hub/kollection/${saved.id}` });
    },
    [history],
  );

  const handleRemove = useCallback(() => {
    if (!app) return;
    void (async () => {
      const ok = await confirm({
        title: intl.formatMessage(messages.removeTitle, { name: app.name }),
        message: intl.formatMessage(messages.removeBody),
        confirmLabel: intl.formatMessage(messages.remove),
        destructive: true,
      });
      if (!ok) return;
      setBusy(true);
      setError(null);
      try {
        await apiRemoveKollectionApp(app.id);
        history.push({ pathname: '/hub/kollection' });
      } catch {
        setError(errorText);
        setBusy(false);
      }
    })();
  }, [app, confirm, intl, history, errorText]);

  const back = {
    href: '/hub/kollection',
    label: intl.formatMessage(messages.back),
  };

  if (missing) {
    return (
      <Stage>
        <div className='stage-column'>
          <EmptyState title={intl.formatMessage(messages.missing)} />
        </div>
      </Stage>
    );
  }

  if (!app) {
    return (
      <Stage>
        <LoadingState label={intl.formatMessage(messages.loading)} />
      </Stage>
    );
  }

  const scopes = knownScopes(app.scopes);
  const discoveryUrl = `${window.location.origin}/.well-known/openid-configuration`;

  return (
    <Stage label={app.name}>
      {confirmDialog}
      <KornerDetail
        className='kollection-app'
        back={back}
        hero={
          app.icon_url ? (
            <img src={app.icon_url} alt='' className='kollection-app__icon' />
          ) : undefined
        }
        title={app.name}
        subtitle={app.description || undefined}
        meta={
          <KornerMeta
            items={[
              intl.formatMessage(
                app.signs_in ? messages.signsIn : messages.link,
              ),
              app.signs_in &&
                intl.formatMessage(
                  app.connected ? messages.connected : messages.notConnected,
                ),
              app.keeper
                ? intl.formatMessage(messages.keptBy, { acct: app.keeper.acct })
                : intl.formatMessage(messages.noKeeper),
            ]}
          />
        }
        actions={
          <KornerActionBar>
            {app.website && (
              <KornerPill
                variant='primary'
                label={intl.formatMessage(messages.open)}
                onClick={handleOpen}
              />
            )}
            {app.connected && (
              <KornerPill
                variant='destructive'
                label={intl.formatMessage(messages.disconnect)}
                onClick={handleDisconnect}
                disabled={busy}
              />
            )}
            {app.can_manage && (
              <KornerPill
                label={intl.formatMessage(messages.edit)}
                onClick={handleEdit}
                disabled={busy}
              />
            )}
            {app.can_manage && (
              <KornerPill
                variant='destructive'
                label={intl.formatMessage(messages.remove)}
                onClick={handleRemove}
                disabled={busy}
              />
            )}
          </KornerActionBar>
        }
      >
        {app.status === 'pulled' && (
          <p className='kollection-app__pulled' role='status'>
            <FormattedMessage {...messages.pulled} />
          </p>
        )}
        {error && (
          <p className='kollection-app__error' role='alert'>
            {error}
          </p>
        )}

        <section className='kollection-app__section'>
          <h2 className='kollection-app__heading'>
            <FormattedMessage {...messages.seesTitle} />
          </h2>
          {app.signs_in ? (
            <ul className='kollection-app__scopes'>
              {scopes.map((scope) => (
                <li key={scope}>
                  <FormattedMessage {...scopeMessages[scope]} />
                </li>
              ))}
            </ul>
          ) : (
            <p className='kollection-app__text'>
              <FormattedMessage {...messages.seesLink} />
            </p>
          )}
        </section>

        {app.client_id && (
          <section className='kollection-app__section'>
            <h2 className='kollection-app__heading'>
              <FormattedMessage {...messages.keysTitle} />
            </h2>
            <p className='kollection-app__text'>
              <FormattedMessage {...messages.keysHint} />
            </p>
            <dl className='kollection-app__keys'>
              <dt>
                <FormattedMessage {...messages.clientId} />
              </dt>
              <dd>
                <code>{app.client_id}</code>
              </dd>
              <dt>
                <FormattedMessage {...messages.clientSecret} />
              </dt>
              <dd>
                <code>{app.client_secret}</code>
              </dd>
              <dt>
                <FormattedMessage {...messages.redirects} />
              </dt>
              {(app.redirect_uris ?? []).map((uri) => (
                <dd key={uri}>
                  <code>{uri}</code>
                </dd>
              ))}
              <dt>
                <FormattedMessage {...messages.discovery} />
              </dt>
              <dd>
                <code>{discoveryUrl}</code>
              </dd>
            </dl>
          </section>
        )}
      </KornerDetail>

      {editing && app.can_manage && (
        <AppComposer
          editId={app.id}
          onCancel={handleEditCancel}
          onSaved={handleSaved}
        />
      )}
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default KollectionAppPage;
