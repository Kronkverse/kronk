import { defineMessages, useIntl } from 'react-intl';

import type { KommonsNode } from '../data/nodes';

const messages = defineMessages({
  url: { id: 'kommons_tree.node.url', defaultMessage: 'URL' },
  status: { id: 'kommons_tree.node.status', defaultMessage: 'Status' },
  file: { id: 'kommons_tree.node.file', defaultMessage: 'Plant feedback on this page' },
  empty: {
    id: 'kommons_tree.node.empty',
    defaultMessage: 'No open proposals on this page yet. Plant the first one.',
  },
  mockOpen: {
    id: 'kommons_tree.node.mock_open',
    defaultMessage: '{count, plural, one {# open proposal} other {# open proposals}} on this page (backend pending).',
  },
  lifecycleLive: { id: 'kommons_tree.lifecycle.live', defaultMessage: 'Live' },
  lifecycleSoon: { id: 'kommons_tree.lifecycle.soon', defaultMessage: 'Soon' },
  lifecycleDeprecated: { id: 'kommons_tree.lifecycle.deprecated', defaultMessage: 'Deprecated' },
  lifecycleHidden: { id: 'kommons_tree.lifecycle.hidden', defaultMessage: 'Hidden' },
});

interface Props {
  node: KommonsNode;
  onFile: () => void;
}

export const NodeDetail: React.FC<Props> = ({ node, onFile }) => {
  const intl = useIntl();

  const lifecycleLabel = {
    live: intl.formatMessage(messages.lifecycleLive),
    soon: intl.formatMessage(messages.lifecycleSoon),
    deprecated: intl.formatMessage(messages.lifecycleDeprecated),
    hidden: intl.formatMessage(messages.lifecycleHidden),
  }[node.lifecycle];

  return (
    <div className='kommons-tree__detail'>
      <h2 className='kommons-tree__detail-title'>{node.label}</h2>

      <dl className='kommons-tree__detail-meta'>
        <div className='kommons-tree__detail-row'>
          <dt>{intl.formatMessage(messages.url)}</dt>
          <dd><code>{node.url}</code></dd>
        </div>
        <div className='kommons-tree__detail-row'>
          <dt>{intl.formatMessage(messages.status)}</dt>
          <dd>
            <span className={`kommons-tree__badge kommons-tree__badge--${node.lifecycle}`}>
              {lifecycleLabel}
            </span>
          </dd>
        </div>
      </dl>

      <div className='kommons-tree__detail-proposals'>
        {node.openProposals > 0
          ? <p>{intl.formatMessage(messages.mockOpen, { count: node.openProposals })}</p>
          : <p className='kommons-tree__detail-empty'>{intl.formatMessage(messages.empty)}</p>}
      </div>

      <button type='button' className='button button--kommons-tree' onClick={onFile}>
        {intl.formatMessage(messages.file)}
      </button>
    </div>
  );
};
