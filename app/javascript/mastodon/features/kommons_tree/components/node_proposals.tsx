import { useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import api from 'mastodon/api';

// A page-node's open proposals — the feedback suggesting changes to that page.
// Shared by the Lattice leaf panel and the space/node meta pages so both drill
// from a page (the tree leaf) to the proposals on it. Each links to the routed
// proposal page (`/hub/kommons/p/:id`).

interface NodeProposal {
  id: string;
  title: string;
}

const messages = defineMessages({
  loading: {
    id: 'kommons.node_proposals.loading',
    defaultMessage: 'Loading proposals…',
  },
  empty: {
    id: 'kommons.node_proposals.empty',
    defaultMessage: 'No open proposals on this page yet. Plant the first one.',
  },
});

// Scope to a single page-node (`nodeId`) or to a whole korner (`korner`, the
// union across its pages — used by the Space page). Exactly one is expected.
export const NodeProposals: React.FC<{ nodeId?: string; korner?: string }> = ({
  nodeId,
  korner,
}) => {
  const intl = useIntl();
  const [proposals, setProposals] = useState<NodeProposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = korner
      ? { korner, filter: 'open' }
      : { node_id: nodeId, filter: 'open' };
    api()
      .get('/api/v1/proposals', { params })
      .then((res) => {
        if (active) setProposals(res.data as NodeProposal[]);
        return undefined;
      })
      .catch(() => {
        if (active) setProposals([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [nodeId, korner]);

  if (loading) {
    return (
      <p className='kommons-node-proposals__status'>
        {intl.formatMessage(messages.loading)}
      </p>
    );
  }

  if (proposals.length === 0) {
    return (
      <p className='kommons-node-proposals__empty'>
        {intl.formatMessage(messages.empty)}
      </p>
    );
  }

  return (
    <ul className='kommons-node-proposals'>
      {proposals.map((proposal) => (
        <li key={proposal.id} className='kommons-node-proposals__item'>
          <Link
            to={`/hub/kommons/p/${proposal.id}`}
            className='kommons-node-proposals__link'
          >
            <span className='kommons-node-proposals__title'>
              {proposal.title}
            </span>
            <span
              className='kommons-node-proposals__chevron'
              aria-hidden='true'
            >
              {'›'}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
};
