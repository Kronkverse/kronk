// Kommons Tree — feedback-tree drilldown surface inside Kommons.
//
// Route: /hub/kommons/tree
// Concept: three top buckets (Feed / Profile / Hub), drill down to a
//   page-type node, plant a feedback proposal on that node.
//
// Node identity is a stable id (route name or korner slug) — see
// data/nodes.ts. The mock data stands in until the backend node
// registry ships (portal-me is driving that).
//
// This surface is UI-shell only: proposals list + composer are stubbed.
// Later PRs wire in the real Kommons Proposal model with a node tag.

import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';

import { BucketPicker } from './components/bucket_picker';
import { NodeDetail } from './components/node_detail';
import { PagePicker } from './components/page_picker';
import type { Bucket } from './data/nodes';
import { bucketNodes, findNode, listKorners } from './data/nodes';

const messages = defineMessages({
  title: { id: 'kommons_tree.title', defaultMessage: '\u20aeommons \u00b7 Tree' },
  crumbBuckets: { id: 'kommons_tree.crumb.buckets', defaultMessage: 'All spaces' },
  crumbKorners: { id: 'kommons_tree.crumb.korners', defaultMessage: 'Korners' },
  back: { id: 'kommons_tree.back', defaultMessage: 'Back' },
  composerStub: {
    id: 'kommons_tree.composer_stub',
    defaultMessage: 'Composer stub \u2014 in the real flow this opens the Kommons proposal wizard with node prefilled to \u201c{node}\u201d.',
  },
  composerDismiss: { id: 'kommons_tree.composer_dismiss', defaultMessage: 'Got it' },
});

type Step = 'buckets' | 'pages' | 'detail';

interface CrumbProps {
  onClick?: () => void;
  children: React.ReactNode;
}

const Crumb: React.FC<CrumbProps> = ({ onClick, children }) => (
  <button type='button' className='kommons-tree__crumb' onClick={onClick} disabled={!onClick}>
    {children}
  </button>
);

const bucketLabel = (b: Bucket): string => {
  switch (b) {
    case 'feed': return 'Feed';
    case 'profile': return 'Profile';
    case 'hub': return 'Hub';
  }
};

const KommonsTree: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();

  const [step, setStep] = useState<Step>('buckets');
  const [bucket, setBucket] = useState<Bucket | null>(null);
  const [kornerSlug, setKornerSlug] = useState<string | null>(null);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

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

  const handleNode = useCallback((id: string) => {
    setNodeId(id);
    setStep('detail');
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

  const selectedNode = nodeId ? findNode(nodeId) : null;

  const title = intl.formatMessage(messages.title);

  return (
    <Column bindToDocument={!multiColumn} label={title}>
      <ColumnHeader icon='gavel' title={title} multiColumn={multiColumn} />

      <div className='kommons-tree'>
        <nav className='kommons-tree__breadcrumb' aria-label='breadcrumb'>
          <Crumb onClick={step === 'buckets' ? undefined : goToBuckets}>
            {intl.formatMessage(messages.crumbBuckets)}
          </Crumb>
          {bucket && (
            <>
              <span className='kommons-tree__crumb-sep' aria-hidden='true'>/</span>
              <Crumb onClick={step === 'pages' && !kornerSlug ? undefined : handleBackFromPages}>
                {bucketLabel(bucket)}
              </Crumb>
            </>
          )}
          {bucket === 'hub' && kornerSlug && (
            <>
              <span className='kommons-tree__crumb-sep' aria-hidden='true'>/</span>
              <Crumb onClick={step === 'pages' ? undefined : handleBackFromDetail}>
                {kornerSlug}
              </Crumb>
            </>
          )}
          {selectedNode && (
            <>
              <span className='kommons-tree__crumb-sep' aria-hidden='true'>/</span>
              <Crumb>{selectedNode.label}</Crumb>
            </>
          )}
        </nav>

        {step === 'buckets' && <BucketPicker onSelect={handleBucket} />}

        {step === 'pages' && bucket === 'hub' && !kornerSlug && (
          <PagePicker
            bucket='hub'
            korners={listKorners()}
            onSelectKorner={handleKorner}
            onSelectNode={handleNode}
          />
        )}

        {step === 'pages' && bucket === 'hub' && kornerSlug && (
          <PagePicker
            bucket='hub'
            nodes={bucketNodes('hub', kornerSlug)}
            onSelectNode={handleNode}
          />
        )}

        {step === 'pages' && bucket && bucket !== 'hub' && (
          <PagePicker
            bucket={bucket}
            nodes={bucketNodes(bucket)}
            onSelectNode={handleNode}
          />
        )}

        {step === 'detail' && selectedNode && (
          <NodeDetail node={selectedNode} onFile={openComposer} />
        )}

        {composerOpen && selectedNode && (
          <div className='kommons-tree__composer-stub' role='dialog' aria-modal='true'>
            <p>{intl.formatMessage(messages.composerStub, { node: selectedNode.id })}</p>
            <button type='button' className='button' onClick={dismissComposer}>
              {intl.formatMessage(messages.composerDismiss)}
            </button>
          </div>
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
export default KommonsTree;
