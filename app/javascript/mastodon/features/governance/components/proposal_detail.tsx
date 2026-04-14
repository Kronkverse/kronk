import { useState } from 'react';

import { FormattedMessage } from 'react-intl';

import ChevronLeftIcon from '@/material-icons/400-24px/chevron_left.svg?react';

import { Icon } from 'mastodon/components/icon';

import type { Proposal } from '../index';
import { TabContribute } from './proposal_tabs/tab_contribute';
import { TabPlan } from './proposal_tabs/tab_plan';
import { TabProposal } from './proposal_tabs/tab_proposal';

type Tab = 'proposal' | 'plan' | 'contribute';

export const ProposalDetail: React.FC<{
  proposal: Proposal;
  onBack: () => void;
  onVoteUpdate: (updated: Proposal) => void;
}> = ({ proposal, onBack, onVoteUpdate }) => {
  const [activeTab, setActiveTab] = useState<Tab>('proposal');

  return (
    <div className='governance-detail'>
      <button className='governance-detail__back' onClick={onBack}>
        <Icon id='chevron-left' icon={ChevronLeftIcon} />
        <FormattedMessage id='governance.back' defaultMessage='All proposals' />
      </button>

      <h2 className='governance-detail__title'>{proposal.title}</h2>

      <div className='governance-detail__tabs'>
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
      </div>

      <div className='governance-detail__content'>
        {activeTab === 'proposal' && (
          <TabProposal proposal={proposal} onVoteUpdate={onVoteUpdate} />
        )}
        {activeTab === 'plan' && <TabPlan proposalId={proposal.id} />}
        {activeTab === 'contribute' && <TabContribute proposalId={proposal.id} />}
      </div>
    </div>
  );
};
