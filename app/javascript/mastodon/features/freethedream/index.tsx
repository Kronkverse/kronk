import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Redirect, Route, Switch } from 'react-router-dom';

import { Stage } from 'mastodon/components/stage';

import { AuditPage } from './components/audit_page';
import { Inventory } from './components/inventory';
import { ItemPage } from './components/item_page';
import { ProjectList } from './components/project_list';
import { ProjectPage } from './components/project_page';
import { WorkPage } from './components/work_page';

// FreeTheDream — a self-organising system for bringing things to life
// together (docs/spaces/freethedream.md). The Frame draws the title and the
// view picker (all · mine · inventory) from the manifest; emergence, item
// and audit pages are detail routes under it. An emergence is a top-level
// project in the code; its gangs are the projects under it.
//
//   /hub/freethedream             every emergence
//   /hub/freethedream/mine        emergences you're in
//   /hub/freethedream/inventory   your inventory
//   /hub/freethedream/composer    seed an emergence (the Ж menu)
//   /hub/freethedream/p/:id       an emergence's landing page (a gang's page)
//   /hub/freethedream/p/:id/:list one list of its work (needed, bring,
//                                 actualise, offers; gear, jobs and ideas
//                                 redirect)
//   /hub/freethedream/p/:id/audit its synergistic audit (nothing links here
//                                 while it is reworked)
//   /hub/freethedream/p/:id/kontribute  -> p/:id (retired)
//   /hub/freethedream/:id         -> p/:id (where korner attachments link)
//   /hub/freethedream/i/:id       something to bring, to actualise, or on
//                                 offer

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
          <Redirect
            exact
            from='/hub/freethedream/p/:id/kontribute'
            to='/hub/freethedream/p/:id'
          />
          <Route path='/hub/freethedream/p/:id' exact>
            <ProjectPage />
          </Route>
          <Route path='/hub/freethedream/p/:id/:list' exact>
            <WorkPage />
          </Route>
          <Redirect
            exact
            from='/hub/freethedream/:id(\d+)'
            to='/hub/freethedream/p/:id'
          />
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
