import { useCallback, useEffect, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Link, useHistory, useLocation, useParams } from 'react-router-dom';

import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import {
  apiDisconnectKollectionApp,
  apiGetKollectionApp,
  isKollectionCategory,
  isKollectionPlatform,
} from 'mastodon/api/kollection';
import type { ApiKollectionAppJSON } from 'mastodon/api/kollection';
import { EmptyState } from 'mastodon/components/empty_state';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerDetail } from 'mastodon/components/korner_detail';
import { KornerMeta } from 'mastodon/components/korner_meta';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LoadingState } from 'mastodon/components/loading_state';
import { Stage } from 'mastodon/components/stage';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';
import { useConfirmDialog } from 'mastodon/hooks/useConfirmDialog';
import { useNamedLink } from 'mastodon/hooks/useNamedLink';

import { AppComposer } from './app_composer';
import { AppLetter } from './app_letter';
import { categoryMessages, platformMessages } from './details';
import { knownScopes, scopeMessages } from './scopes';

// One app in Kollection (docs/spaces/kollection.md, An app's page), at
// /hub/kollection/<name>: an app store style listing on <Stage> +
// <KornerDetail>. The cover over the top, then the icon, name, tagline and
// who made it, a big Open, Get the app when it has a download (and
// Disconnect when you are connected), the
// screenshots in a row that scrolls sideways (each opens full size), what it
// is, its details, what it can see of you, and which of your Mates use it.
// Its keeper and admins also see what Sign in with Kronk needs (client key
// and secret, redirect URIs). Edit is the Ж menu's page action, as on an
// album; /hub/kollection/<name>/edit opens the composer over the page, and
// Remove is in the composer. Opened by an old name or its number, the
// address takes its name (useNamedLink). No Konnected block: Kollection
// takes no Konnections (manifest `no_attachments`).

const messages = defineMessages({
  back: { id: 'kollection.title', defaultMessage: 'Kollection' },
  loading: { id: 'kollection.app.loading', defaultMessage: 'Loading app…' },
  missing: {
    id: 'kollection.app.missing',
    defaultMessage: 'This app isn’t in Kollection.',
  },
  madeBy: { id: 'kollection.app.made_by', defaultMessage: 'By {name}' },
  connected: { id: 'kollection.card.connected', defaultMessage: 'Connected' },
  pulled: {
    id: 'kollection.app.pulled',
    defaultMessage:
      'Pulled by an admin: it is off the list and can’t sign anyone in.',
  },
  open: { id: 'kollection.app.open', defaultMessage: 'Open' },
  getApp: { id: 'kollection.app.get_app', defaultMessage: 'Get the app' },
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
  edit: { id: 'kollection.app.edit', defaultMessage: 'Edit app' },
  error: {
    id: 'kollection.app.error',
    defaultMessage: 'That didn’t work. Try again?',
  },
  screenshotsLabel: {
    id: 'kollection.app.screenshots',
    defaultMessage: 'Screenshots',
  },
  screenshotOpen: {
    id: 'kollection.app.screenshot_open',
    defaultMessage: 'Screenshot {n}, full size',
  },
  aboutTitle: { id: 'kollection.app.about_title', defaultMessage: 'About' },
  detailsTitle: { id: 'kollection.app.details', defaultMessage: 'Details' },
  detailMadeBy: {
    id: 'kollection.app.detail_made_by',
    defaultMessage: 'Made by',
  },
  detailCategory: {
    id: 'kollection.app.detail_category',
    defaultMessage: 'Category',
  },
  detailPlatforms: {
    id: 'kollection.app.detail_platforms',
    defaultMessage: 'Works on',
  },
  detailWebsite: {
    id: 'kollection.app.detail_website',
    defaultMessage: 'Website',
  },
  detailSignIn: {
    id: 'kollection.app.detail_sign_in',
    defaultMessage: 'Sign-in',
  },
  signsIn: {
    id: 'kollection.card.signs_in',
    defaultMessage: 'Sign in with Kronk',
  },
  ownSignIn: {
    id: 'kollection.app.own_sign_in',
    defaultMessage: 'Its own',
  },
  detailKeeper: {
    id: 'kollection.app.detail_keeper',
    defaultMessage: 'Kept by',
  },
  noKeeper: { id: 'kollection.app.no_keeper', defaultMessage: 'No keeper' },
  seesTitle: {
    id: 'kollection.app.sees_title',
    defaultMessage: 'What it can see of you',
  },
  seesLink: {
    id: 'kollection.app.sees_link',
    defaultMessage:
      'Nothing through Kronk. It has its own sign-in, and Kronk shares nothing with it.',
  },
  matesTitle: {
    id: 'kollection.app.mates_title',
    defaultMessage: 'Mates using it',
  },
  matesNone: {
    id: 'kollection.app.mates_none',
    defaultMessage: 'None of your Mates use it yet.',
  },
  matesLink: {
    id: 'kollection.app.mates_link',
    defaultMessage:
      '{name} has its own sign-in, so Kronk can’t tell who uses it.',
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

// "https://you.example/start" reads as "you.example".
const hostOf = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

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

  useNamedLink(id, app?.slug);

  useEffect(() => {
    let cancelled = false;
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

  const handleGetApp = useCallback(() => {
    if (app?.download_url) window.open(app.download_url, '_blank', 'noopener');
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

  const slug = app?.slug ?? id;
  const handleEdit = useCallback(() => {
    history.push({ pathname: `/hub/kollection/${slug}/edit` });
  }, [history, slug]);

  useRegisterPageAction(
    {
      key: 'edit',
      label: intl.formatMessage(messages.edit),
      icon: EditIcon,
      iconId: 'edit',
    },
    handleEdit,
    !!app?.can_manage && !editing,
  );

  const handleEditCancel = useCallback(() => {
    history.push({ pathname: `/hub/kollection/${slug}` });
  }, [history, slug]);

  const handleSaved = useCallback(
    (saved: ApiKollectionAppJSON) => {
      setApp(saved);
      history.push({ pathname: `/hub/kollection/${saved.slug}` });
    },
    [history],
  );

  const handleRemoved = useCallback(() => {
    history.push({ pathname: '/hub/kollection' });
  }, [history]);

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
  const shots = app.screenshots ?? [];
  const mates = app.mates_using ?? [];
  const platforms = app.platforms.filter(isKollectionPlatform);
  const discoveryUrl = `${window.location.origin}/.well-known/openid-configuration`;

  return (
    <Stage label={app.name}>
      {confirmDialog}
      <KornerDetail
        className='kollection-app'
        back={back}
        hero={
          app.cover_url ? (
            <img src={app.cover_url} alt='' className='kollection-app__cover' />
          ) : undefined
        }
        banner={
          app.icon_url ? (
            <img src={app.icon_url} alt='' className='kollection-app__icon' />
          ) : (
            <AppLetter name={app.name} large />
          )
        }
        title={app.name}
        subtitle={app.tagline || undefined}
        meta={
          <KornerMeta
            items={[
              app.made_by &&
                intl.formatMessage(messages.madeBy, { name: app.made_by }),
              app.connected && intl.formatMessage(messages.connected),
            ]}
          />
        }
        actions={
          <KornerActionBar>
            {app.website && app.status === 'live' && (
              <KornerPill
                variant='primary'
                className='kollection-app__open'
                label={intl.formatMessage(messages.open)}
                onClick={handleOpen}
              />
            )}
            {app.download_url && app.status === 'live' && (
              <KornerPill
                variant={app.website ? undefined : 'primary'}
                className='kollection-app__open'
                label={intl.formatMessage(messages.getApp)}
                onClick={handleGetApp}
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

        {shots.length > 0 && (
          <ul
            className='kollection-app__shots'
            aria-label={intl.formatMessage(messages.screenshotsLabel)}
          >
            {shots.map((shot, i) => (
              <li key={shot.id}>
                <a
                  href={shot.url}
                  target='_blank'
                  rel='noopener'
                  aria-label={intl.formatMessage(messages.screenshotOpen, {
                    n: i + 1,
                  })}
                >
                  <img
                    src={shot.preview_url}
                    alt={shot.description ?? ''}
                    loading='lazy'
                  />
                </a>
              </li>
            ))}
          </ul>
        )}

        {app.description && (
          <section className='kollection-app__section'>
            <h2 className='kollection-app__heading'>
              <FormattedMessage {...messages.aboutTitle} />
            </h2>
            <p className='kollection-app__text kollection-app__description'>
              {app.description}
            </p>
          </section>
        )}

        <section className='kollection-app__section'>
          <h2 className='kollection-app__heading'>
            <FormattedMessage {...messages.detailsTitle} />
          </h2>
          <dl className='kollection-app__details'>
            {app.made_by && (
              <>
                <dt>
                  <FormattedMessage {...messages.detailMadeBy} />
                </dt>
                <dd>{app.made_by}</dd>
              </>
            )}
            {isKollectionCategory(app.category) && (
              <>
                <dt>
                  <FormattedMessage {...messages.detailCategory} />
                </dt>
                <dd>
                  <FormattedMessage {...categoryMessages[app.category]} />
                </dd>
              </>
            )}
            {platforms.length > 0 && (
              <>
                <dt>
                  <FormattedMessage {...messages.detailPlatforms} />
                </dt>
                <dd>
                  {platforms
                    .map((p) => intl.formatMessage(platformMessages[p]))
                    .join(', ')}
                </dd>
              </>
            )}
            {app.website && (
              <>
                <dt>
                  <FormattedMessage {...messages.detailWebsite} />
                </dt>
                <dd>
                  <a href={app.website} target='_blank' rel='noopener'>
                    {hostOf(app.website)}
                  </a>
                </dd>
              </>
            )}
            <dt>
              <FormattedMessage {...messages.detailSignIn} />
            </dt>
            <dd>
              {intl.formatMessage(
                app.signs_in ? messages.signsIn : messages.ownSignIn,
              )}
            </dd>
            <dt>
              <FormattedMessage {...messages.detailKeeper} />
            </dt>
            <dd>
              {app.keeper ? (
                <Link to={`/@${app.keeper.acct}`}>@{app.keeper.acct}</Link>
              ) : (
                intl.formatMessage(messages.noKeeper)
              )}
            </dd>
          </dl>
        </section>

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

        <section className='kollection-app__section'>
          <h2 className='kollection-app__heading'>
            <FormattedMessage {...messages.matesTitle} />
          </h2>
          {!app.signs_in ? (
            <p className='kollection-app__text'>
              <FormattedMessage
                {...messages.matesLink}
                values={{ name: app.name }}
              />
            </p>
          ) : mates.length === 0 ? (
            <p className='kollection-app__text'>
              <FormattedMessage {...messages.matesNone} />
            </p>
          ) : (
            <ul className='kollection-app__mates'>
              {mates.map((mate) => (
                <li key={mate.id}>
                  <Link to={`/@${mate.acct}`} title={`@${mate.acct}`}>
                    <img src={mate.avatar} alt='' />
                    <span>{mate.display_name || mate.username}</span>
                  </Link>
                </li>
              ))}
            </ul>
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
          onRemoved={handleRemoved}
        />
      )}
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default KollectionAppPage;
