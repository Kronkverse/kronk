import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Link, useHistory, useParams } from 'react-router-dom';

import api from 'mastodon/api';
import { apiGetKommonsNodes } from 'mastodon/api/kommons_nodes';
import type { ApiKommonsNode } from 'mastodon/api/kommons_nodes';
import { Stage } from 'mastodon/components/stage';

import { ProposalCard } from './components/proposal_card';
import type { Proposal } from './types';

// The page for a single node (/hub/kommons/node/:nodeId) — reached by tapping
// a page in the Kommons tree.
//
// What it is for (Tal 2026-09-10): "it basically shows everything about a
// particular page which someone might want to see… It also shows proposals
// (active & completed) and opens the composer to that specific page. This is
// how people can explore different spaces, learn about them, see the
// intricacies of how and why they work, rather than just the space to use the
// features."
//
// This is the first cut of that, and it is deliberately only the proposals
// half: what the page does, what it is tied into, how many people use it —
// all of that comes later. Metadata that used to sit at the top (the raw URL,
// a lifecycle chip, a "connected pages" list) is out, because it made the page
// read as a debug view of a registry entry rather than a place to have an
// opinion about a part of Kronk.
//
// Proposals render through `<ProposalCard>` — the same card the Kommons board
// uses, redesigned in 2026-08 after "kommons space is chaotic". A second
// bespoke list is how two surfaces showing the same thing drift apart.

const messages = defineMessages({
  title: { id: 'node_meta.title', defaultMessage: 'Page' },
  open: { id: 'node_meta.open', defaultMessage: 'Open proposals' },
  completed: { id: 'node_meta.completed', defaultMessage: 'Already delivered' },
  none: {
    id: 'node_meta.none',
    defaultMessage: 'Nothing has been proposed about this page yet.',
  },
  propose: {
    id: 'node_meta.propose',
    defaultMessage: 'Propose a change',
  },
  loading: { id: 'node_meta.loading', defaultMessage: 'Loading…' },
  notFound: {
    id: 'node_meta.not_found',
    defaultMessage: 'This page could not be found.',
  },
});

const useProposals = (nodeId: string, filter: 'open' | 'completed') => {
  const [proposals, setProposals] = useState<Proposal[] | null>(null);

  useEffect(() => {
    let active = true;
    setProposals(null);
    api()
      .get('/api/v1/proposals', { params: { node_id: nodeId, filter } })
      .then((res) => {
        if (active) setProposals(res.data as Proposal[]);
        return undefined;
      })
      .catch(() => {
        if (active) setProposals([]);
      });
    return () => {
      active = false;
    };
  }, [nodeId, filter]);

  return proposals;
};

const NodeMetaPage: React.FC<{ multiColumn?: boolean }> = () => {
  const { nodeId = '' } = useParams<{ nodeId: string }>();
  const intl = useIntl();
  const history = useHistory();

  const [nodes, setNodes] = useState<ApiKommonsNode[]>([]);
  const [loaded, setLoaded] = useState(false);

  const open = useProposals(nodeId, 'open');
  const completed = useProposals(nodeId, 'completed');

  useEffect(() => {
    let active = true;
    apiGetKommonsNodes()
      .then((res) => {
        if (active) {
          setNodes(res.nodes);
          setLoaded(true);
        }
        return undefined;
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const node = nodes.find((n) => n.id === nodeId);
  const name = node?.label ?? nodeId;

  const openProposal = useCallback(
    (id: string) => {
      history.push(`/hub/kommons/p/${id}`);
    },
    [history],
  );

  // Location object, not a string: the app's history wrapper folds a
  // `path?query` string whole into the pathname, so the composer would open
  // unscoped (see components/router.tsx, and propose_picker.tsx:63).
  const proposeHere = useCallback(() => {
    history.push({
      pathname: '/hub/kommons/propose',
      search: `?node=${nodeId}`,
    });
  }, [history, nodeId]);

  // Kronk's org pages are Rails-served, so a full navigation; SPA routes use
  // an in-app link.
  const isRails = node?.url.startsWith('/kronk') ?? false;

  return (
    <Stage label={name}>
      <Helmet>
        <title>{`${name} — ${intl.formatMessage(messages.title)}`}</title>
      </Helmet>

      <div className='node-page'>
        {loaded && !node && (
          <p className='node-page__status'>
            {intl.formatMessage(messages.notFound)}
          </p>
        )}

        {node && (
          <>
            <header className='node-page__head'>
              <h1 className='node-page__name'>{node.label}</h1>
              {isRails ? (
                <a href={node.url} className='node-page__visit'>
                  <FormattedMessage
                    id='node_meta.goto'
                    defaultMessage='Go to this page'
                  />
                </a>
              ) : (
                <Link to={node.url} className='node-page__visit'>
                  <FormattedMessage
                    id='node_meta.goto'
                    defaultMessage='Go to this page'
                  />
                </Link>
              )}
            </header>

            <section className='node-page__section'>
              <div className='node-page__section-head'>
                <h2 className='node-page__heading'>
                  {intl.formatMessage(messages.open)}
                </h2>
                {open && open.length > 0 && (
                  <span className='node-page__count'>{open.length}</span>
                )}
              </div>

              {open === null ? (
                <p className='node-page__status'>
                  {intl.formatMessage(messages.loading)}
                </p>
              ) : open.length === 0 ? (
                <p className='node-page__empty'>
                  {intl.formatMessage(messages.none)}
                </p>
              ) : (
                <div className='node-page__proposals'>
                  {open.map((proposal) => (
                    <ProposalCard
                      key={proposal.id}
                      proposal={proposal}
                      onSelect={openProposal}
                    />
                  ))}
                </div>
              )}

              {/* The propose action sits under the list rather than in the
                  header: the invitation reads better after you have seen what
                  is already being said, and on an empty page it is the only
                  thing to do. */}
              <button
                type='button'
                className='node-page__propose'
                onClick={proposeHere}
              >
                {intl.formatMessage(messages.propose)}
              </button>
            </section>

            {completed && completed.length > 0 && (
              <section className='node-page__section node-page__section--quiet'>
                <div className='node-page__section-head'>
                  <h2 className='node-page__heading'>
                    {intl.formatMessage(messages.completed)}
                  </h2>
                  <span className='node-page__count'>{completed.length}</span>
                </div>
                <div className='node-page__proposals'>
                  {completed.map((proposal) => (
                    <ProposalCard
                      key={proposal.id}
                      proposal={proposal}
                      onSelect={openProposal}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default NodeMetaPage;
