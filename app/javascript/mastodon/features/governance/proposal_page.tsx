import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useHistory, useParams } from 'react-router-dom';

import api from 'mastodon/api';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { useKorner } from 'mastodon/hooks/useKorner';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

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
const ProposalPage: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const { proposalId } = useParams<{ proposalId: string }>();
  const history = useHistory();
  const korner = useKorner('kommons');
  const kornerIcon = useKornerIcon('kommons');
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

  const handleBack = useCallback(() => {
    history.push('/hub/kommons');
  }, [history]);

  const handleVoteUpdate = useCallback((updated: Proposal) => {
    setProposal(updated);
  }, []);

  const handleArchived = useCallback(() => {
    history.push('/hub/kommons');
  }, [history]);

  return (
    <Column>
      <ColumnHeader
        title={korner?.name ?? 'Kommons'}
        icon='kommons'
        iconComponent={kornerIcon}
        multiColumn={multiColumn}
      />

      <Helmet>
        <title>{proposal?.title ?? intl.formatMessage(messages.title)}</title>
      </Helmet>

      <div className='governance-page'>
        {loading && (
          <div className='governance-page__empty'>
            <FormattedMessage
              id='governance.loading'
              defaultMessage='Loading seeds…'
            />
          </div>
        )}

        {!loading && notFound && (
          <div className='governance-page__empty'>
            <FormattedMessage
              id='governance.proposal_not_found'
              defaultMessage='This seed could not be found.'
            />
          </div>
        )}

        {!loading && proposal && (
          <ProposalDetail
            proposal={proposal}
            onBack={handleBack}
            onVoteUpdate={handleVoteUpdate}
            onArchived={handleArchived}
          />
        )}
      </div>
    </Column>
  );
};

export { ProposalPage };
