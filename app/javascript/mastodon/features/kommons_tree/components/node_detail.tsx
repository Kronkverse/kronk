import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type { KommonsNode, LinkKind } from '../data/nodes';
import { findNode } from '../data/nodes';

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
  connectionsHeader: {
    id: 'kommons_tree.node.connections_header',
    defaultMessage: '{count, plural, one {# connection} other {# connections}}',
  },
  connectionsHint: {
    id: 'kommons_tree.node.connections_hint',
    defaultMessage: 'Links to other pages \u2014 event bus, feed projection, shared settings.',
  },
  linkKindCreates: { id: 'kommons_tree.link.creates', defaultMessage: 'creates' },
  linkKindListedOn: { id: 'kommons_tree.link.listed_on', defaultMessage: 'listed on' },
  linkKindProjectsTo: { id: 'kommons_tree.link.projects_to', defaultMessage: 'projects to' },
  linkKindListensTo: { id: 'kommons_tree.link.listens_to', defaultMessage: 'listens to' },
  linkKindSettingsFor: { id: 'kommons_tree.link.settings_for', defaultMessage: 'settings for' },
  linkKindRelated: { id: 'kommons_tree.link.related', defaultMessage: 'related' },
});

const linkKindMessage = (kind: LinkKind) => {
  switch (kind) {
    case 'creates': return messages.linkKindCreates;
    case 'listed_on': return messages.linkKindListedOn;
    case 'projects_to': return messages.linkKindProjectsTo;
    case 'listens_to': return messages.linkKindListensTo;
    case 'settings_for': return messages.linkKindSettingsFor;
    case 'related': return messages.linkKindRelated;
  }
};

interface Props {
  node: KommonsNode;
  onFile: () => void;
  onNavigate?: (nodeId: string) => void;
}

export const NodeDetail: React.FC<Props> = ({ node, onFile, onNavigate }) => {
  const intl = useIntl();
  const [connectionsOpen, setConnectionsOpen] = useState(false);

  const lifecycleLabel = {
    live: intl.formatMessage(messages.lifecycleLive),
    soon: intl.formatMessage(messages.lifecycleSoon),
    deprecated: intl.formatMessage(messages.lifecycleDeprecated),
    hidden: intl.formatMessage(messages.lifecycleHidden),
  }[node.lifecycle];

  const links = node.links ?? [];

  const toggleConnections = useCallback(() => {
    setConnectionsOpen(v => !v);
  }, []);

  const handleTargetClick = useCallback<React.MouseEventHandler<HTMLButtonElement>>((e) => {
    const id = e.currentTarget.dataset.nodeId;
    if (id && onNavigate) onNavigate(id);
  }, [onNavigate]);

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

      {links.length > 0 && (
        <div className={`kommons-tree__connections kommons-tree__connections--${connectionsOpen ? 'open' : 'closed'}`}>
          <button
            type='button'
            className='kommons-tree__connections-toggle'
            aria-expanded={connectionsOpen}
            onClick={toggleConnections}
          >
            <span className='kommons-tree__connections-chevron' aria-hidden='true'>{connectionsOpen ? '\u25BE' : '\u25B8'}</span>
            <span className='kommons-tree__connections-count'>
              {intl.formatMessage(messages.connectionsHeader, { count: links.length })}
            </span>
          </button>

          {connectionsOpen && (
            <div className='kommons-tree__connections-body'>
              <p className='kommons-tree__connections-hint'>
                {intl.formatMessage(messages.connectionsHint)}
              </p>
              <ul className='kommons-tree__connections-list'>
                {links.map((link, i) => {
                  const target = findNode(link.to);
                  const targetLabel = target?.label ?? link.to;
                  return (
                    <li key={`${link.to}-${i}`} className='kommons-tree__connection'>
                      <span className={`kommons-tree__connection-kind kommons-tree__connection-kind--${link.kind}`}>
                        {intl.formatMessage(linkKindMessage(link.kind))}
                      </span>
                      {target && onNavigate
                        ? (
                          <button type='button' data-node-id={link.to} className='kommons-tree__connection-target' onClick={handleTargetClick}>
                            {targetLabel}
                          </button>
                        )
                        : <span className='kommons-tree__connection-target'>{targetLabel}</span>}
                      <span className='kommons-tree__connection-desc'>{link.description}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      <button type='button' className='button button--kommons-tree' onClick={onFile}>
        {intl.formatMessage(messages.file)}
      </button>
    </div>
  );
};
