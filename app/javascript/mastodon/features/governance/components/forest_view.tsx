import { useCallback, useEffect, useState } from 'react';

import { FormattedMessage } from 'react-intl';

import ArrowBackIcon from '@/material-icons/400-24px/arrow_back.svg?react';
import api from 'mastodon/api';
import { Icon } from 'mastodon/components/icon';

import type { Proposal } from '../types';

import { ProposalCard } from './proposal_card';

export const ForestView: React.FC<{
  onBack: () => void;
  onSelect: (id: string) => void;
}> = ({ onBack, onSelect }) => {
  const [trees, setTrees] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api().get<Proposal[]>('/api/v1/proposals', { params: { filter: 'delivered' } });
        if (!cancelled) setTrees(res.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleVoteUpdate = useCallback((updated: Proposal) => {
    setTrees((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  return (
    <div className='governance-forest'>
      <button className='governance-forest__back' onClick={onBack}>
        <Icon id='arrow-back' icon={ArrowBackIcon} />
        <FormattedMessage id='governance.back' defaultMessage='All seeds' />
      </button>

      <h2 className='governance-forest__title'>
        <FormattedMessage id='governance.forest.title' defaultMessage='The Forest' />
      </h2>
      <p className='governance-forest__intro'>
        <FormattedMessage
          id='governance.forest.intro'
          defaultMessage='Seeds that grew into trees — things we built together.'
        />
      </p>

      {loading && (
        <div className='governance-page__empty'>
          <FormattedMessage id='governance.loading' defaultMessage='Loading seeds…' />
        </div>
      )}

      {!loading && trees.length === 0 && (
        <div className='governance-page__empty'>
          <FormattedMessage id='governance.forest.empty' defaultMessage='No trees yet. Keep planting.' />
        </div>
      )}

      <div className='governance-page__list'>
        {trees.map((tree) => (
          <ProposalCard
            key={tree.id}
            proposal={tree}
            onSelect={onSelect}
            onVoteUpdate={handleVoteUpdate}
          />
        ))}
      </div>
    </div>
  );
};
