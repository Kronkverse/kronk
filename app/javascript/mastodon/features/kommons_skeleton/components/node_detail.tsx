import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type { KommonsNode, LinkKind } from '../data/nodes';
import { findNode } from '../data/nodes';

import { NodeProposals } from './node_proposals';

const messages = defineMessages({
  url: { id: 'kommons_skeleton.node.url', defaultMessage: 'URL' },
  status: { id: 'kommons_skeleton.node.status', defaultMessage: 'Status' },
  file: {
    id: 'kommons_skeleton.node.file',
    defaultMessage: 'Plant feedback on this page',
  },
  lifecycleLive: { id: 'kommons_skeleton.lifecycle.live', defaultMessage: 'Live' },
  lifecycleSoon: { id: 'kommons_skeleton.lifecycle.soon', defaultMessage: 'Soon' },
  lifecycleDeprecated: {
    id: 'kommons_skeleton.lifecycle.deprecated',
    defaultMessage: 'Deprecated',
  },
  lifecycleHidden: {
    id: 'kommons_skeleton.lifecycle.hidden',
    defaultMessage: 'Hidden',
  },
  connectionsHeader: {
    id: 'kommons_skeleton.node.connections_header',
    defaultMessage: '{count, plural, one {# connection} other {# connections}}',
  },
  connectionsHint: {
    id: 'kommons_skeleton.node.connections_hint',
    defaultMessage:
      'Links to other pages \u2014 event bus, feed projection, shared settings.',
  },
  linkKindCreates: {
    id: 'kommons_skeleton.link.creates',
    defaultMessage: 'creates',
  },
  linkKindListedOn: {
    id: 'kommons_skeleton.link.listed_on',
    defaultMessage: 'listed on',
  },
  linkKindProjectsTo: {
    id: 'kommons_skeleton.link.projects_to',
    defaultMessage: 'projects to',
  },
  linkKindListensTo: {
    id: 'kommons_skeleton.link.listens_to',
    defaultMessage: 'listens to',
  },
  linkKindSettingsFor: {
    id: 'kommons_skeleton.link.settings_for',
    defaultMessage: 'settings for',
  },
  linkKindRelated: {
    id: 'kommons_skeleton.link.related',
    defaultMessage: 'related',
  },
});

const linkKindMessage = (kind: LinkKind) => {
  switch (kind) {
    case 'creates':
      return messages.linkKindCreates;
    case 'listed_on':
      return messages.linkKindListedOn;
    case 'projects_to':
      return messages.linkKindProjectsTo;
    case 'listens_to':
      return messages.linkKindListensTo;
    case 'settings_for':
      return messages.linkKindSettingsFor;
    case 'related':
      return messages.linkKindRelated;
  }
};

interface Props {
  node: KommonsNode;
  nodes: KommonsNode[];
  onFile: () => void;
  onNavigate?: (nodeId: string) => void;
}

export const NodeDetail: React.FC<Props> = ({
  node,
  nodes,
  onFile,
  onNavigate,
}) => {
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
    setConnectionsOpen((v) => !v);
  }, []);

  const handleTargetClick = useCallback<
    React.MouseEventHandler<HTMLButtonElement>
  >(
    (e) => {
      const id = e.currentTarget.dataset.nodeId;
      if (id && onNavigate) onNavigate(id);
    },
    [onNavigate],
  );

  return (
    <div className='kommons-skeleton__detail'>
      <h2 className='kommons-skeleton__detail-title'>{node.label}</h2>

      <dl className='kommons-skeleton__detail-meta'>
        <div className='kommons-skeleton__detail-row'>
          <dt>{intl.formatMessage(messages.url)}</dt>
          <dd>
            <code>{node.url}</code>
          </dd>
        </div>
        <div className='kommons-skeleton__detail-row'>
          <dt>{intl.formatMessage(messages.status)}</dt>
          <dd>
            <span
              className={`kommons-skeleton__badge kommons-skeleton__badge--${node.lifecycle}`}
            >
              {lifecycleLabel}
            </span>
          </dd>
        </div>
      </dl>

      <div className='kommons-skeleton__detail-proposals'>
        <NodeProposals nodeId={node.id} />
      </div>

      {links.length > 0 && (
        <div
          className={`kommons-skeleton__connections kommons-skeleton__connections--${connectionsOpen ? 'open' : 'closed'}`}
        >
          <button
            type='button'
            className='kommons-skeleton__connections-toggle'
            aria-expanded={connectionsOpen}
            onClick={toggleConnections}
          >
            <span
              className='kommons-skeleton__connections-chevron'
              aria-hidden='true'
            >
              {connectionsOpen ? '\u25BE' : '\u25B8'}
            </span>
            <span className='kommons-skeleton__connections-count'>
              {intl.formatMessage(messages.connectionsHeader, {
                count: links.length,
              })}
            </span>
          </button>

          {connectionsOpen && (
            <div className='kommons-skeleton__connections-body'>
              <p className='kommons-skeleton__connections-hint'>
                {intl.formatMessage(messages.connectionsHint)}
              </p>
              <ul className='kommons-skeleton__connections-list'>
                {links.map((link, i) => {
                  const target = findNode(nodes, link.to);
                  const targetLabel = target?.label ?? link.to;
                  return (
                    <li
                      key={`${link.to}-${i}`}
                      className='kommons-skeleton__connection'
                    >
                      <span
                        className={`kommons-skeleton__connection-kind kommons-skeleton__connection-kind--${link.kind}`}
                      >
                        {intl.formatMessage(linkKindMessage(link.kind))}
                      </span>
                      {target && onNavigate ? (
                        <button
                          type='button'
                          data-node-id={link.to}
                          className='kommons-skeleton__connection-target'
                          onClick={handleTargetClick}
                        >
                          {targetLabel}
                        </button>
                      ) : (
                        <span className='kommons-skeleton__connection-target'>
                          {targetLabel}
                        </span>
                      )}
                      <span className='kommons-skeleton__connection-desc'>
                        {link.description}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      <button
        type='button'
        className='button button--kommons-skeleton'
        onClick={onFile}
      >
        {intl.formatMessage(messages.file)}
      </button>
    </div>
  );
};
