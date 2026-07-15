import { defineMessages, useIntl } from 'react-intl';

import type { Bucket, KommonsNode, KornerSummary } from '../data/nodes';

const messages = defineMessages({
  chooseKorner: {
    id: 'kommons_tree.choose_korner',
    defaultMessage: 'Pick a korner. Each one has pages of its own.',
  },
  choosePage: {
    id: 'kommons_tree.choose_page',
    defaultMessage: 'Pick the page you want to plant feedback on.',
  },
  proposals: {
    id: 'kommons_tree.open_count',
    defaultMessage:
      '{count, plural, one {# open proposal} other {# open proposals}}',
  },
  pages: {
    id: 'kommons_tree.pages_count',
    defaultMessage: '{count, plural, one {# page} other {# pages}}',
  },
  lifecycleSoon: { id: 'kommons_tree.lifecycle.soon', defaultMessage: 'Soon' },
  lifecycleDeprecated: {
    id: 'kommons_tree.lifecycle.deprecated',
    defaultMessage: 'Deprecated',
  },
  lifecycleHidden: {
    id: 'kommons_tree.lifecycle.hidden',
    defaultMessage: 'Hidden',
  },
});

interface Props {
  bucket: Bucket;
  korners?: KornerSummary[];
  nodes?: KommonsNode[];
  onSelectKorner?: (slug: string) => void;
  onSelectNode: (nodeId: string) => void;
}

const LifecycleBadge: React.FC<{ lifecycle: KommonsNode['lifecycle'] }> = ({
  lifecycle,
}) => {
  const intl = useIntl();
  if (lifecycle === 'live') return null;
  const label =
    lifecycle === 'soon'
      ? intl.formatMessage(messages.lifecycleSoon)
      : lifecycle === 'deprecated'
        ? intl.formatMessage(messages.lifecycleDeprecated)
        : intl.formatMessage(messages.lifecycleHidden);
  return (
    <span className={`kommons-tree__badge kommons-tree__badge--${lifecycle}`}>
      {label}
    </span>
  );
};

export const PagePicker: React.FC<Props> = ({
  bucket,
  korners,
  nodes,
  onSelectKorner,
  onSelectNode,
}) => {
  const intl = useIntl();

  if (bucket === 'hub' && korners && onSelectKorner) {
    const handleKornerClick = (slug: string) => () => {
      onSelectKorner(slug);
    };
    return (
      <div className='kommons-tree__picker'>
        <p className='kommons-tree__intro'>
          {intl.formatMessage(messages.chooseKorner)}
        </p>
        <ul className='kommons-tree__list'>
          {korners.map((k) => (
            <li key={k.slug}>
              <button
                type='button'
                className='kommons-tree__row'
                onClick={handleKornerClick(k.slug)}
              >
                <span className='kommons-tree__row-label'>{k.label}</span>
                <LifecycleBadge lifecycle={k.lifecycle} />
                <span className='kommons-tree__row-meta'>
                  {intl.formatMessage(messages.pages, { count: k.nodeCount })}
                  {' \u00b7 '}
                  {intl.formatMessage(messages.proposals, {
                    count: k.openProposals,
                  })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (!nodes) return null;

  const handleNodeClick = (id: string) => () => {
    onSelectNode(id);
  };

  return (
    <div className='kommons-tree__picker'>
      <p className='kommons-tree__intro'>
        {intl.formatMessage(messages.choosePage)}
      </p>
      <ul className='kommons-tree__list'>
        {nodes.map((n) => (
          <li key={n.id}>
            <button
              type='button'
              className='kommons-tree__row'
              onClick={handleNodeClick(n.id)}
            >
              <span className='kommons-tree__row-label'>{n.label}</span>
              <LifecycleBadge lifecycle={n.lifecycle} />
              <span className='kommons-tree__row-url'>{n.url}</span>
              <span className='kommons-tree__row-meta'>
                {intl.formatMessage(messages.proposals, {
                  count: n.openProposals,
                })}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
