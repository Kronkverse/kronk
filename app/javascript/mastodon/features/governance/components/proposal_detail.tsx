import { useState } from 'react';

import { FormattedMessage, FormattedDate } from 'react-intl';

import ArrowBackIcon from '@/material-icons/400-24px/arrow_back.svg?react';

import { Icon } from 'mastodon/components/icon';

import type { Proposal } from '../index';
import { TabContribute } from './proposal_tabs/tab_contribute';
import { TabPlan } from './proposal_tabs/tab_plan';
import { TabProposal } from './proposal_tabs/tab_proposal';

type Tab = 'proposal' | 'plan' | 'contribute' | 'discussion';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const statusLabels: Record<Proposal['status'], string> = {
  open: 'Open',
  in_progress: 'In progress',
  vetoed: 'Vetoed',
  delivered: 'Delivered',
};

export const ProposalDetail: React.FC<{
  proposal: Proposal;
  onBack: () => void;
  onVoteUpdate: (updated: Proposal) => void;
}> = ({ proposal, onBack, onVoteUpdate }) => {
  const [activeTab, setActiveTab] = useState<Tab>('proposal');

  return (
    <div className='governance-detail'>
      <div className='governance-detail__page'>
        <button className='governance-detail__back' onClick={onBack}>
          <Icon id='arrow-back' icon={ArrowBackIcon} />
          <FormattedMessage id='governance.back' defaultMessage='All proposals' />
        </button>

        <div className='governance-detail__topbar'>
          <h1 className='governance-detail__title'>{proposal.title}</h1>
          <span className={`governance-detail__status governance-detail__status--${proposal.status}`}>
            {statusLabels[proposal.status]}
          </span>
        </div>

        <p className='governance-detail__meta'>
          <FormattedMessage
            id='governance.detail.proposed_by'
            defaultMessage='Proposed by {name}'
            values={{ name: proposal.created_by_account.username }}
          />
          {' · '}
          <FormattedDate value={proposal.created_at} day='numeric' month='short' year='numeric' />
          {proposal.categories.length > 0 && (
            <>
              {' · '}
              {proposal.categories.map(cap).join(', ')}
            </>
          )}
        </p>

        <nav className='governance-detail__tabs'>
          <button
            className={`governance-detail__tab ${activeTab === 'proposal' ? 'active' : ''}`}
            onClick={() => setActiveTab('proposal')}
          >
            <FormattedMessage id='governance.tab.proposal' defaultMessage='Proposal' />
          </button>
          <button
            className={`governance-detail__tab ${activeTab === 'plan' ? 'active' : ''}`}
            onClick={() => setActiveTab('plan')}
          >
            <FormattedMessage id='governance.tab.plan' defaultMessage='Plan' />
          </button>
          <button
            className={`governance-detail__tab ${activeTab === 'contribute' ? 'active' : ''}`}
            onClick={() => setActiveTab('contribute')}
          >
            <FormattedMessage id='governance.tab.contribute' defaultMessage='Contribute' />
          </button>
          <button
            className={`governance-detail__tab ${activeTab === 'discussion' ? 'active' : ''}`}
            onClick={() => setActiveTab('discussion')}
          >
            <FormattedMessage id='governance.tab.discussion' defaultMessage='Discussion' />
          </button>
        </nav>

        <div className='governance-detail__content'>
          {activeTab === 'proposal' && (
            <TabProposal proposal={proposal} onVoteUpdate={onVoteUpdate} />
          )}
          {activeTab === 'plan' && <TabPlan proposalId={proposal.id} />}
          {activeTab === 'contribute' && <TabContribute proposalId={proposal.id} />}
          {activeTab === 'discussion' && (
            <p className='governance-detail__placeholder'>
              <FormattedMessage
                id='governance.discussion.unavailable'
                defaultMessage='Discussion not yet available.'
              />
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
