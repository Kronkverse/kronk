import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Redirect, Route, Switch } from 'react-router-dom';
import type { RouteComponentProps } from 'react-router-dom';

import { Stage } from 'mastodon/components/stage';

import { ItemPage } from './components/item_page';
import { ProjectPage } from './components/project_page';
import { WorkPage } from './components/work_page';

// Projekts (FreeTheDream in the code): a self-organising system for
// bringing things to life together (docs/spaces/freethedream.md). Projekts
// live inside Krews (Tal, 2026-10-30): there is no list of every projekt,
// and a projekt's pages sit under its Krew, in a plain <Stage> with the
// Krew's badge. An emergence is a top-level project in the code; its gangs
// are the projects under it.
//
//   /hub/krew/:krew/p/:id        a projekt's page (a gang's, a fractal's)
//   /hub/krew/:krew/p/:id/:list  one list of its work (needed, bring,
//                                actualise, offers; gear, jobs and ideas
//                                redirect)
//   /hub/krew/:krew/i/:id        something to bring, to actualise, or on
//                                offer
//   /hub/krew/composer/projekt   seed one in one of your Krews, over the
//                                Krews page (features/krew)
//
// The old /hub/freethedream addresses still open: p/:id, p/:id/:list and
// i/:id render the page, which moves the address under its Krew
// (useKrewAddress); :id goes to p/:id; composer goes to the new composer;
// anything else (the list, Mine, Mycelium) goes to your Krews.

const messages = defineMessages({
  title: { id: 'freethedream.title', defaultMessage: 'Projekts' },
});

const toComposer = ({ location }: RouteComponentProps) => (
  <Redirect
    to={{ pathname: '/hub/krew/composer/projekt', search: location.search }}
  />
);

const FreeTheDream: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const title = intl.formatMessage(messages.title);

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
        <Route path='/hub/freethedream/composer' exact render={toComposer} />
        <Route
          path={['/hub/freethedream/p/:id', '/hub/krew/:krew/p/:id']}
          exact
        >
          {detail(<ProjectPage />)}
        </Route>
        <Route
          path={[
            '/hub/freethedream/p/:id/:list',
            '/hub/krew/:krew/p/:id/:list',
          ]}
          exact
        >
          {detail(<WorkPage />)}
        </Route>
        <Route
          path={['/hub/freethedream/i/:id', '/hub/krew/:krew/i/:id']}
          exact
        >
          {detail(<ItemPage />)}
        </Route>
        <Redirect to='/hub/krew' />
      </Switch>
    </>
  );
};

// eslint-disable-next-line import/no-default-export
export default FreeTheDream;
