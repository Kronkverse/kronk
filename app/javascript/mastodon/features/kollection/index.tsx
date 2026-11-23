import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import { apiGetKollectionApps } from 'mastodon/api/kollection';
import type { ApiKollectionAppJSON } from 'mastodon/api/kollection';
import { EmptyState } from 'mastodon/components/empty_state';
import { Icon } from 'mastodon/components/icon';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerPill } from 'mastodon/components/korner_pill';
import { KornerShell } from 'mastodon/components/korner_shell';
import { LoadingState } from 'mastodon/components/loading_state';
import { SpaceCard, SpaceGrid } from 'mastodon/components/space_grid';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

import { AppComposer } from './app_composer';

// /hub/kollection — Kollection (docs/spaces/kollection.md): every app
// linked to Kronk, A to Z, as a grid of cards. Each says whether it signs
// in with Kronk or is a link, and whether you are connected. A card opens
// the app's page (app_page.tsx), where you see what it can see of you and
// disconnect. The Add an app button above the grid (<KornerActionBar> +
// a primary <KornerPill>) goes to /hub/kollection/composer, which opens the
// composer over the list. Nothing is added to the Ж menu: the manifest has
// no `compose:` (Tal, 2026-11-23). The apps you are connected to are also
// on /hub/kollection/settings (settings.tsx).

const messages = defineMessages({
  title: { id: 'kollection.title', defaultMessage: 'Kollection' },
  loading: { id: 'kollection.loading', defaultMessage: 'Loading apps…' },
  error: {
    id: 'kollection.error',
    defaultMessage: "Couldn't load the apps. Try again?",
  },
  emptyTitle: {
    id: 'kollection.empty.title',
    defaultMessage: 'No apps linked yet.',
  },
  emptyBody: {
    id: 'kollection.empty.body',
    defaultMessage: 'Add one with Add an app.',
  },
  add: { id: 'kollection.add', defaultMessage: 'Add an app' },
  signsIn: {
    id: 'kollection.card.signs_in',
    defaultMessage: 'Sign in with Kronk',
  },
  link: { id: 'kollection.card.link', defaultMessage: 'A link' },
  connected: { id: 'kollection.card.connected', defaultMessage: 'Connected' },
  pulled: { id: 'kollection.card.pulled', defaultMessage: 'Pulled' },
});

const AppGrid: React.FC<{ reloadKey: number }> = ({ reloadKey }) => {
  const intl = useIntl();
  const KornerIcon = useKornerIcon('kollection');
  const [apps, setApps] = useState<ApiKollectionAppJSON[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiGetKollectionApps()
      .then((rows) => {
        if (!cancelled) setApps(rows);
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (failed) return <EmptyState title={intl.formatMessage(messages.error)} />;
  if (apps === null)
    return <LoadingState label={intl.formatMessage(messages.loading)} />;
  if (apps.length === 0)
    return (
      <EmptyState
        title={intl.formatMessage(messages.emptyTitle)}
        body={intl.formatMessage(messages.emptyBody)}
      />
    );

  return (
    <SpaceGrid className='kollection__grid'>
      {apps.map((app) => (
        <SpaceCard
          key={app.id}
          to={`/hub/kollection/${app.id}`}
          image={app.icon_url}
          placeholder={<Icon id='kollection' icon={KornerIcon} />}
          title={app.name}
          meta={intl.formatMessage(
            app.signs_in ? messages.signsIn : messages.link,
          )}
          tag={
            app.status === 'pulled'
              ? intl.formatMessage(messages.pulled)
              : app.connected
                ? intl.formatMessage(messages.connected)
                : undefined
          }
          tagKind={app.status === 'pulled' ? 'pulled' : undefined}
        />
      ))}
    </SpaceGrid>
  );
};

const Kollection: React.FC<{
  multiColumn?: boolean;
  autoOpenComposer?: boolean;
}> = ({ autoOpenComposer = false }) => {
  const intl = useIntl();
  const history = useHistory();
  const [reloadKey, setReloadKey] = useState(0);

  const handleCancel = useCallback(() => {
    history.push({ pathname: '/hub/kollection' });
  }, [history]);

  const handleSaved = useCallback(
    (app: ApiKollectionAppJSON) => {
      setReloadKey((key) => key + 1);
      history.push({ pathname: `/hub/kollection/${app.id}` });
    },
    [history],
  );

  const handleAdd = useCallback(() => {
    history.push({ pathname: '/hub/kollection/composer' });
  }, [history]);

  const addLabel = intl.formatMessage(messages.add);
  const renderAll = useCallback(
    () => (
      <>
        <KornerActionBar className='kollection__actions'>
          <KornerPill variant='primary' label={addLabel} onClick={handleAdd} />
        </KornerActionBar>
        <AppGrid reloadKey={reloadKey} />
      </>
    ),
    [reloadKey, addLabel, handleAdd],
  );

  return (
    <KornerShell
      slug='kollection'
      label={intl.formatMessage(messages.title)}
      className='scrollable kollection'
      defaultView='all'
      views={{ all: renderAll }}
    >
      {autoOpenComposer && (
        <AppComposer onCancel={handleCancel} onSaved={handleSaved} />
      )}
    </KornerShell>
  );
};

// eslint-disable-next-line import/no-default-export
export default Kollection;
