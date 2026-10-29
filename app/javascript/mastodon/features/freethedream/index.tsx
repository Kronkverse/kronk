import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Redirect, Route, Switch, useLocation } from 'react-router-dom';

import { KornerShell } from 'mastodon/components/korner_shell';
import { Stage } from 'mastodon/components/stage';

import { ItemPage } from './components/item_page';
import { Mycelium } from './components/mycelium';
import { ProjectList } from './components/project_list';
import { ProjectPage } from './components/project_page';
import { WorkPage } from './components/work_page';

// FreeTheDream — a self-organising system for bringing things to life
// together (docs/spaces/freethedream.md). The landing sits in
// <KornerShell>: the Frame draws the badge, the rotating title (all ·
// mine · Mycelium, each with its tagline) from the manifest's `views:`,
// and the URL picks the view. Emergence and item pages are detail routes
// in a plain <Stage>. An emergence is a top-level project in the code;
// its gangs are the projects under it.
//
//   /hub/freethedream             every emergence
//   /hub/freethedream/mine        emergences you're in
//   /hub/freethedream/mycelium    your Mycelium: what you have, to share
//   /hub/freethedream/inventory   -> mycelium
//   /hub/freethedream/composer    seed an emergence (the Ж menu), over
//                                 every emergence
//   /hub/freethedream/p/:id       an emergence's landing page (a gang's page)
//   /hub/freethedream/p/:id/:list one list of its work (needed, bring,
//                                 actualise, offers; gear, jobs and ideas
//                                 redirect)
//   /hub/freethedream/p/:id/audit -> p/:id (retired with Mycelium)
//   /hub/freethedream/p/:id/kontribute  -> p/:id (retired)
//   /hub/freethedream/:id         -> p/:id (where korner attachments link)
//   /hub/freethedream/i/:id       something to bring, to actualise, or on
//                                 offer

const messages = defineMessages({
  title: { id: 'freethedream.title', defaultMessage: 'FreeTheDream' },
});

const COMPOSER_PATH = '/hub/freethedream/composer';

const renderMine = () => <ProjectList scope='mine' />;
const renderMycelium = () => <Mycelium />;

const FreeTheDream: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const { pathname } = useLocation();
  const title = intl.formatMessage(messages.title);
  const composing = pathname.replace(/\/$/, '') === COMPOSER_PATH;

  const detail = (page: React.ReactNode) => (
    <Stage label={title}>
      <div className='freethedream'>{page}</div>
    </Stage>
  );

  return (
    <>
      <Helmet>
        <title>{title}</title>
      </Helmet>
      <Switch>
        <Redirect
          exact
          from='/hub/freethedream/inventory'
          to='/hub/freethedream/mycelium'
        />
        <Redirect
          exact
          from='/hub/freethedream/p/:id/audit'
          to='/hub/freethedream/p/:id'
        />
        <Redirect
          exact
          from='/hub/freethedream/p/:id/kontribute'
          to='/hub/freethedream/p/:id'
        />
        <Redirect
          exact
          from='/hub/freethedream/:id(\d+)'
          to='/hub/freethedream/p/:id'
        />
        <Route path='/hub/freethedream/p/:id' exact>
          {detail(<ProjectPage />)}
        </Route>
        <Route path='/hub/freethedream/p/:id/:list' exact>
          {detail(<WorkPage />)}
        </Route>
        <Route path='/hub/freethedream/i/:id' exact>
          {detail(<ItemPage />)}
        </Route>
        <Route>
          <KornerShell
            slug='freethedream'
            label={title}
            className='freethedream'
            defaultView='all'
            views={{
              all: () => <ProjectList scope='all' composer={composing} />,
              mine: renderMine,
              mycelium: renderMycelium,
            }}
          />
        </Route>
      </Switch>
    </>
  );
};

// eslint-disable-next-line import/no-default-export
export default FreeTheDream;
