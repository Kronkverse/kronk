// Kommons Tree — feedback-tree drilldown surface inside Kommons.
//
// Route: /hub/kommons/skeleton
// Concept: three top buckets (Feed / Profile / Hub), drill down to a
//   page-type node, plant a feedback proposal on that node.
//
// Node identity is a stable id (see lib/kronk/node_registry.rb).
// Nodes come from GET /api/v1/kommons/nodes (backend PR #295 shipped
// the registry). Connections still mocked client-side pending PR 3.

import { Fragment, useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import { apiGetKommonsNodes } from 'mastodon/api/kommons_nodes';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';

import { Composer } from './components/composer';
import { NodeDetail } from './components/node_detail';
import { BodyMap } from './components/body_map';
import type { KommonsNode } from './data/nodes';
import { findNode, fromApiNodes } from './data/nodes';
import { ROOT_ID } from './data/layout';

const messages = defineMessages({
  title: {
    id: 'kommons_skeleton.title',
    defaultMessage: '\u20aeommons \u00b7 Tree',
  },
  crumbBuckets: {
    id: 'kommons_skeleton.crumb.buckets',
    defaultMessage: 'All spaces',
  },
  loading: {
    id: 'kommons_skeleton.loading',
    defaultMessage: 'Loading the tree\u2026',
  },
  loadError: {
    id: 'kommons_skeleton.load_error',
    defaultMessage: 'Could not load the Kommons tree. Refresh to try again.',
  },
});


interface CrumbProps {
  onClick?: () => void;
  children: React.ReactNode;
}

const Crumb: React.FC<CrumbProps> = ({ onClick, children }) => (
  <button
    type='button'
    className='kommons-skeleton__crumb'
    onClick={onClick}
    disabled={!onClick}
  >
    {children}
  </button>
);

const LIMB_LABELS: Record<string, string> = {
  feed: 'Feed',
  profile: 'Profile',
  hub: 'Hub',
};

// A crumb id is a limb, a `korner:<slug>` handle, or a real node id.
const crumbLabel = (nodes: KommonsNode[], id: string): string => {
  if (LIMB_LABELS[id]) return LIMB_LABELS[id];
  if (id.startsWith('korner:')) {
    const slug = id.slice('korner:'.length);
    return slug.charAt(0).toUpperCase() + slug.slice(1);
  }
  return findNode(nodes, id)?.label ?? id;
};

const KommonsSkeleton: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();

  const [nodes, setNodes] = useState<KommonsNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Position in the body, root first. The camera and every node's emphasis
  // derive from this — there is no separate step machine.
  const [path, setPath] = useState<string[]>([ROOT_ID]);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    apiGetKommonsNodes()
      .then((res) => {
        if (cancelled) return;
        setNodes(fromApiNodes(res.nodes));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const refetch = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  const handleFocus = useCallback((id: string) => {
    setPath((prev) => {
      if (id === ROOT_ID) return [ROOT_ID];
      const idx = prev.indexOf(id);
      if (idx >= 0) return prev.slice(0, idx + 1);
      return [...prev, id];
    });
    setNodeId(null);
  }, []);

  const handleOpenLeaf = useCallback((id: string) => {
    setNodeId(id);
  }, []);

  const handleBackFromDetail = useCallback(() => {
    setNodeId(null);
    setStep('pages');
  }, []);

  const openComposer = useCallback(() => {
    setComposerOpen(true);
  }, []);
  const dismissComposer = useCallback(() => {
    setComposerOpen(false);
  }, []);

  const onComposerSuccess = useCallback(() => {
    setComposerOpen(false);
    refetch();
  }, [refetch]);

  const selectedNode = nodeId ? findNode(nodes, nodeId) : null;
  const title = intl.formatMessage(messages.title);

  return (
    <Column bindToDocument={!multiColumn} label={title}>
      <ColumnHeader icon='gavel' title={title} multiColumn={multiColumn} />

      <div
        className={`kommons-skeleton ${selectedNode ? '' : 'kommons-skeleton--map'}`}
      >
        {loading && (
          <p className='kommons-skeleton__loading'>
            {intl.formatMessage(messages.loading)}
          </p>
        )}
        {loadError && (
          <p className='kommons-skeleton__error'>
            {intl.formatMessage(messages.loadError)}
          </p>
        )}

        {!loading && !loadError && (
          <>
            <nav className='kommons-skeleton__breadcrumb' aria-label='breadcrumb'>
              {path.map((stepId, i) => (
                <Fragment key={stepId}>
                  {i > 0 && (
                    <span
                      className='kommons-skeleton__crumb-sep'
                      aria-hidden='true'
                    >
                      /
                    </span>
                  )}
                  <Crumb
                    onClick={
                      i === path.length - 1 && !selectedNode
                        ? undefined
                        : () => {
                            handleFocus(stepId);
                          }
                    }
                  >
                    {i === 0
                      ? intl.formatMessage(messages.crumbBuckets)
                      : crumbLabel(nodes, stepId)}
                  </Crumb>
                </Fragment>
              ))}
              {selectedNode && (
                <>
                  <span
                    className='kommons-skeleton__crumb-sep'
                    aria-hidden='true'
                  >
                    /
                  </span>
                  <Crumb onClick={handleBackFromDetail}>
                    {selectedNode.label}
                  </Crumb>
                </>
              )}
            </nav>

            {!selectedNode && (
              <BodyMap
                nodes={nodes}
                path={path}
                onFocus={handleFocus}
                onOpenLeaf={handleOpenLeaf}
              />
            )}

            {selectedNode && (
              <NodeDetail
                node={selectedNode}
                nodes={nodes}
                onFile={openComposer}
                onNavigate={handleOpenLeaf}
              />
            )}
          </>
        )}

        {composerOpen && selectedNode && (
          <Composer
            node={selectedNode}
            onSuccess={onComposerSuccess}
            onDismiss={dismissComposer}
          />
        )}
      </div>

      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export
export default KommonsSkeleton;
