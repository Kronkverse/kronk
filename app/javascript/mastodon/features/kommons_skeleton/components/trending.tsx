import { useCallback, useEffect, useState } from 'react';

import { FormattedMessage } from 'react-intl';

import api from 'mastodon/api';

import type { KommonsNode } from '../data/nodes';

// What the community is backing right now, across every korner.
//
// The Skeleton answers "what is being said about this page". Trending answers
// the question the walk cannot: "what is being said at all". It deliberately
// ignores the tree — a proposal's rank comes from agreement, not from where it
// sits — and clicking one drops you back onto its node with the breadcrumb
// rebuilt, so the two views stay coherent with each other.
interface TrendingProposal {
  id: string;
  title: string;
  node_id: string | null;
  vote_summary: { agree: number; abstain: number; block: number };
}

export const Trending: React.FC<{
  nodes: KommonsNode[];
  onSelectNode: (id: string) => void;
}> = ({ nodes, onSelectNode }) => {
  const [items, setItems] = useState<TrendingProposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api().get('/api/v1/proposals', {
          params: { sort: 'most_supported' },
        });
        setItems(res.data as TrendingProposal[]);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const labelFor = useCallback(
    (nodeId: string | null) =>
      nodeId ? (nodes.find((n) => n.id === nodeId)?.label ?? nodeId) : null,
    [nodes],
  );

  const handleClick = useCallback(
    (nodeId: string | null) => () => {
      if (nodeId) onSelectNode(nodeId);
    },
    [onSelectNode],
  );

  if (loading) {
    return (
      <p className='kommons-skeleton__loading'>
        <FormattedMessage
          id='kommons_skeleton.trending.loading'
          defaultMessage='Loading…'
        />
      </p>
    );
  }

  return (
    <div className='kommons-trending'>
      <p className='kommons-trending__lead'>
        <FormattedMessage
          id='kommons_skeleton.trending.lead'
          defaultMessage='What the community is backing right now, across every korner.'
        />
      </p>

      {items.length === 0 ? (
        <p className='kommons-trending__empty'>
          <FormattedMessage
            id='kommons_skeleton.trending.empty'
            defaultMessage='Nothing planted yet. Walk the Skeleton and say something about a page.'
          />
        </p>
      ) : (
        <ol className='kommons-trending__list'>
          {items.map((p, i) => {
            const label = labelFor(p.node_id);
            return (
              <li key={p.id} className='kommons-trending__item'>
                <button
                  type='button'
                  className={`kommons-trending__row ${i < 3 ? 'kommons-trending__row--lead' : ''}`}
                  onClick={handleClick(p.node_id)}
                  disabled={!p.node_id}
                >
                  <span className='kommons-trending__rank'>{i + 1}</span>
                  <span className='kommons-trending__title'>{p.title}</span>
                  {label && (
                    <span className='kommons-trending__node'>{label}</span>
                  )}
                  <span className='kommons-trending__backs'>
                    <FormattedMessage
                      id='kommons_skeleton.trending.agreeing'
                      defaultMessage='{count} agreeing'
                      values={{ count: p.vote_summary?.agree ?? 0 }}
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};
