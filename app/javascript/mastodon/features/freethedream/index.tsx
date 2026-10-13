import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Route, Switch } from 'react-router-dom';

import { Stage } from 'mastodon/components/stage';

import { AuditPage } from './components/audit_page';
import { Inventory } from './components/inventory';
import { ItemPage } from './components/item_page';
import { ProjectList } from './components/project_list';
import { ProjectPage } from './components/project_page';

// FreeTheDream — a self-organising system for running projects together
// (docs/spaces/freethedream.md). The Frame draws the title and the view
// picker (all · mine · inventory) from the manifest; project, item and
// audit pages are detail routes under it.
//
//   /hub/freethedream             every project
//   /hub/freethedream/mine        projects you're in
//   /hub/freethedream/inventory   your inventory
//   /hub/freethedream/composer    start a project (the Ж menu)
//   /hub/freethedream/p/:id       a project or part
//   /hub/freethedream/p/:id/audit its synergistic audit
//   /hub/freethedream/i/:id       an idea, need, job or offer

const messages = defineMessages({
  title: { id: 'freethedream.title', defaultMessage: 'FreeTheDream' },
});

const FreeTheDream: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>
      <div className='freethedream'>
        <Switch>
          <Route path='/hub/freethedream/composer' exact>
            <ProjectList scope='all' composer />
          </Route>
          <Route path='/hub/freethedream/mine' exact>
            <ProjectList scope='mine' />
          </Route>
          <Route path='/hub/freethedream/inventory' exact>
            <Inventory />
          </Route>
          <Route path='/hub/freethedream/p/:id/audit' exact>
            <AuditPage />
          </Route>
          <Route path='/hub/freethedream/p/:id' exact>
            <ProjectPage />
          </Route>
          <Route path='/hub/freethedream/i/:id' exact>
            <ItemPage />
          </Route>
          <Route>
            <ProjectList scope='all' />
          </Route>
        </Switch>
      </div>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default FreeTheDream;
