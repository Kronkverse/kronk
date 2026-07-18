// Kommons Tree — feedback-tree drilldown surface inside Kommons.
//
// Route: /hub/kommons/skeleton
// Concept: three top buckets (Feed / Profile / Hub), drill down to a
//   page-type node, plant a feedback proposal on that node.
//
// Node identity is a stable id (see lib/kronk/node_registry.rb).
// Nodes come from GET /api/v1/kommons/nodes (backend PR #295 shipped
// the registry). Connections still mocked client-side pending PR 3.

import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import { apiGetKommonsNodes } from 'mastodon/api/kommons_nodes';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';

import { BucketPicker } from './components/bucket_picker';
import { Composer } from './components/composer';
import { NodeDetail } from './components/node_detail';
import { PagePicker } from './components/page_picker';
import type { Bucket, KommonsNode } from './data/nodes';
import { bucketNodes, findNode, fromApiNodes, listKorners } from './data/nodes';

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

type Step = 'buckets' | 'pages' | 'detail';

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

const bucketLabel = (b: Bucket): string => {
  switch (b) {
    case 'feed':
      return 'Feed';
    case 'profile':
      return 'Profile';
    case 'hub':
      return 'Hub';
  }
};

const KommonsSkeleton: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();

  const [nodes, setNodes] = useState<KommonsNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [step, setStep] = useState<Step>('buckets');
  const [bucket, setBucket] = useState<Bucket | null>(null);
  const [kornerSlug, setKornerSlug] = useState<string | null>(null);
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

  const goToBuckets = useCallback(() => {
    setStep('buckets');
    setBucket(null);
    setKornerSlug(null);
    setNodeId(null);
  }, []);

  const handleBucket = useCallback((b: Bucket) => {
    setBucket(b);
    setKornerSlug(null);
    setNodeId(null);
    setStep('pages');
  }, []);

  const handleKorner = useCallback((slug: string) => {
    setKornerSlug(slug);
    setNodeId(null);
  }, []);

  const handleBackFromPages = useCallback(() => {
    if (bucket === 'hub' && kornerSlug) {
      setKornerSlug(null);
    } else {
      goToBuckets();
    }
  }, [bucket, kornerSlug, goToBuckets]);

  const handleNode = useCallback(
    (id: string) => {
      const target = findNode(nodes, id);
      if (target) {
        setBucket(target.bucket);
        setKornerSlug(target.parent ?? null);
      }
      setNodeId(id);
      setStep('detail');
    },
    [nodes],
  );

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

      <div className='kommons-skeleton'>
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
              <Crumb onClick={step === 'buckets' ? undefined : goToBuckets}>
                {intl.formatMessage(messages.crumbBuckets)}
              </Crumb>
              {bucket && (
                <>
                  <span className='kommons-skeleton__crumb-sep' aria-hidden='true'>
                    /
                  </span>
                  <Crumb
                    onClick={
                      step === 'pages' && !kornerSlug
                        ? undefined
                        : handleBackFromPages
                    }
                  >
                    {bucketLabel(bucket)}
                  </Crumb>
                </>
              )}
              {bucket === 'hub' && kornerSlug && (
                <>
                  <span className='kommons-skeleton__crumb-sep' aria-hidden='true'>
                    /
                  </span>
                  <Crumb
                    onClick={
                      step === 'pages' ? undefined : handleBackFromDetail
                    }
                  >
                    {kornerSlug}
                  </Crumb>
                </>
              )}
              {selectedNode && (
                <>
                  <span className='kommons-skeleton__crumb-sep' aria-hidden='true'>
                    /
                  </span>
                  <Crumb>{selectedNode.label}</Crumb>
                </>
              )}
            </nav>

            {step === 'buckets' && (
              <BucketPicker nodes={nodes} onSelect={handleBucket} />
            )}

            {step === 'pages' && bucket === 'hub' && !kornerSlug && (
              <PagePicker
                bucket='hub'
                korners={listKorners(nodes)}
                onSelectKorner={handleKorner}
                onSelectNode={handleNode}
              />
            )}

            {step === 'pages' && bucket === 'hub' && kornerSlug && (
              <PagePicker
                bucket='hub'
                nodes={bucketNodes(nodes, 'hub', kornerSlug)}
                onSelectNode={handleNode}
              />
            )}

            {step === 'pages' && bucket && bucket !== 'hub' && (
              <PagePicker
                bucket={bucket}
                nodes={bucketNodes(nodes, bucket)}
                onSelectNode={handleNode}
              />
            )}

            {step === 'detail' && selectedNode && (
              <NodeDetail
                node={selectedNode}
                nodes={nodes}
                onFile={openComposer}
                onNavigate={handleNode}
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
