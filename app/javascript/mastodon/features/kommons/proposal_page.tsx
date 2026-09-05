import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useParams } from 'react-router-dom';

import api from 'mastodon/api';
import { BackToKorner } from 'mastodon/components/back_to_korner';
import { Stage } from 'mastodon/components/stage';

import { ProposalDetail } from './components/proposal_detail';
import type { Proposal } from './types';

const messages = defineMessages({
  title: { id: 'governance.title', defaultMessage: '₭ommons' },
});

// Routed, deep-linkable page for a single proposal (`/hub/kommons/p/:id`).
// Reached by drilling the Kommons tree to a page-node and opening one of the
// proposals on it; also shareable as a plain URL. Wraps the existing in-place
// ProposalDetail, fetching the proposal by id and adapting its callbacks to
// navigation.
const ProposalPage: React.FC<{ multiColumn?: boolean }> = () => {
  const { proposalId } = useParams<{ proposalId: string }>();
  const intl = useIntl();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    api()
      .get(`/api/v1/proposals/${proposalId}`)
      .then((res) => {
        if (active) setProposal(res.data as Proposal);
        return undefined;
      })
      .catch(() => {
        if (active) setNotFound(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [proposalId]);

  const handleVoteUpdate = useCallback((updated: Proposal) => {
    setProposal(updated);
  }, []);

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{proposal?.title ?? intl.formatMessage(messages.title)}</title>
      </Helmet>

      <div className='kommons-page'>
        {/* Site-wide back chip (Tal 2026-08-17). */}
        <BackToKorner href='/hub/kommons' label='Kommons' />

        {loading && (
          <div className='kommons-page__empty'>
            <FormattedMessage
              id='governance.loading'
              defaultMessage='Loading proposals…'
            />
          </div>
        )}

        {!loading && notFound && (
          <div className='kommons-page__empty'>
            <FormattedMessage
              id='governance.proposal_not_found'
              defaultMessage='This proposal could not be found.'
            />
          </div>
        )}

        {!loading && proposal && (
          <ProposalDetail proposal={proposal} onVoteUpdate={handleVoteUpdate} />
        )}
      </div>
    </Stage>
  );
};

export { ProposalPage };
