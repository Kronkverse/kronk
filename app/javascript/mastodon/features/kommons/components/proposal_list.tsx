import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import api from 'mastodon/api';

import type { Proposal } from '../types';

import { ProposalCard } from './proposal_card';

// A list of proposals about one page (`nodeId`) or one whole space (`korner`),
// rendered with the board's `<ProposalCard>`.
//
// It replaced a thin title-and-chevron row that showed nothing but the title.
// A proposal is something a person wrote and is asking others to back; a row
// that hides the author reads like a system message (Tal 2026-09-10: "it needs
// to be more clear that the proposals are things people have created").
//
// Extracted so the node page and the Space page cannot drift: they are the
// same list scoped two ways.

const messages = defineMessages({
  loading: {
    id: 'kommons.proposal_list.loading',
    defaultMessage: 'Loading…',
  },
  empty: {
    id: 'kommons.proposal_list.empty',
    defaultMessage: 'Nothing has been proposed here yet.',
  },
});

interface Props {
  nodeId?: string;
  korner?: string;
  filter?: 'open' | 'completed';
}

export const KommonsProposalList: React.FC<Props> = ({
  nodeId,
  korner,
  filter = 'open',
}) => {
  const intl = useIntl();
  const history = useHistory();
  const [proposals, setProposals] = useState<Proposal[] | null>(null);

  useEffect(() => {
    let active = true;
    setProposals(null);
    const params = korner ? { korner, filter } : { node_id: nodeId, filter };
    api()
      .get('/api/v1/proposals', { params })
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
  }, [nodeId, korner, filter]);

  const open = useCallback(
    (id: string) => {
      history.push(`/hub/kommons/p/${id}`);
    },
    [history],
  );

  if (proposals === null) {
    return (
      <p className='node-page__status'>
        {intl.formatMessage(messages.loading)}
      </p>
    );
  }

  if (proposals.length === 0) {
    return (
      <p className='node-page__empty'>{intl.formatMessage(messages.empty)}</p>
    );
  }

  return (
    <div className='node-page__proposals'>
      {proposals.map((proposal) => (
        <ProposalCard key={proposal.id} proposal={proposal} onSelect={open} />
      ))}
    </div>
  );
};
