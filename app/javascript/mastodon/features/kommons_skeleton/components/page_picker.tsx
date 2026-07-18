import { defineMessages, useIntl } from 'react-intl';

import type { Bucket, KommonsNode, KornerSummary } from '../data/nodes';

const messages = defineMessages({
  chooseKorner: {
    id: 'kommons_skeleton.choose_korner',
    defaultMessage: 'Pick a korner. Each one has pages of its own.',
  },
  choosePage: {
    id: 'kommons_skeleton.choose_page',
    defaultMessage: 'Pick the page you want to plant feedback on.',
  },
  proposals: {
    id: 'kommons_skeleton.open_count',
    defaultMessage:
      '{count, plural, one {# open proposal} other {# open proposals}}',
  },
  pages: {
    id: 'kommons_skeleton.pages_count',
    defaultMessage: '{count, plural, one {# page} other {# pages}}',
  },
  lifecycleSoon: { id: 'kommons_skeleton.lifecycle.soon', defaultMessage: 'Soon' },
  lifecycleDeprecated: {
    id: 'kommons_skeleton.lifecycle.deprecated',
    defaultMessage: 'Deprecated',
  },
  lifecycleHidden: {
    id: 'kommons_skeleton.lifecycle.hidden',
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
    <span className={`kommons-skeleton__badge kommons-skeleton__badge--${lifecycle}`}>
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
      <div className='kommons-skeleton__picker'>
        <p className='kommons-skeleton__intro'>
          {intl.formatMessage(messages.chooseKorner)}
        </p>
        <ul className='kommons-skeleton__list'>
          {korners.map((k) => (
            <li key={k.slug}>
              <button
                type='button'
                className='kommons-skeleton__row'
                onClick={handleKornerClick(k.slug)}
              >
                <span className='kommons-skeleton__row-label'>{k.label}</span>
                <LifecycleBadge lifecycle={k.lifecycle} />
                <span className='kommons-skeleton__row-meta'>
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
    <div className='kommons-skeleton__picker'>
      <p className='kommons-skeleton__intro'>
        {intl.formatMessage(messages.choosePage)}
      </p>
      <ul className='kommons-skeleton__list'>
        {nodes.map((n) => (
          <li key={n.id}>
            <button
              type='button'
              className='kommons-skeleton__row'
              onClick={handleNodeClick(n.id)}
            >
              <span className='kommons-skeleton__row-label'>{n.label}</span>
              <LifecycleBadge lifecycle={n.lifecycle} />
              <span className='kommons-skeleton__row-url'>{n.url}</span>
              <span className='kommons-skeleton__row-meta'>
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
