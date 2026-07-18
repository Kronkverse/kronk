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
import type { TrailStep } from './components/rail';
import { Rail } from './components/rail';
import type { Bucket, KommonsNode } from './data/nodes';
import { findNode, fromApiNodes } from './data/nodes';

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

const BUCKET_LABELS: Record<Bucket, string> = {
  feed: 'Feed',
  profile: 'Profile',
  hub: 'Hub',
};

const trailLabel = (step: TrailStep): string => {
  if (step.kind === 'root') return 'Kronk';
  if (step.kind === 'korner') return step.label;
  return BUCKET_LABELS[step.bucket];
};

// Korner display names live with the node helpers; fall back to the slug so a
// newly-added korner never renders blank.
const listKornerLabel = (slug: string): string | undefined =>
  KORNER_DISPLAY[slug];

const KORNER_DISPLAY: Record<string, string> = {
  kommons: 'Kommons',
  booth: 'Booth',
  kalendar: 'Kalendar',
  marketplace: 'Marketplace',
  kuestions: 'Kuestions',
  inflow: 'Inflow',
  groups: 'Groups',
  huddle: 'Huddle',
  kompass: 'Kompass',
  moments: 'Moments',
  albutts: 'Albutts',
  klot: 'Klot',
  you: 'YOU',
  nudges: 'Nudges',
};

const KommonsSkeleton: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();

  const [nodes, setNodes] = useState<KommonsNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // The trail is the whole position: one step per band, root first. Bands are
  // derived from it, so there is no separate step machine to keep in sync.
  const [trail, setTrail] = useState<TrailStep[]>([{ kind: 'root' }]);
  const [activeDepth, setActiveDepth] = useState(0);
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
    setTrail([{ kind: 'root' }]);
    setActiveDepth(0);
    setNodeId(null);
  }, []);

  // Selecting a card either walks one band deeper, or — if it is a leaf —
  // leaves the walk entirely and opens that page's proposals.
  const handleSelect = useCallback(
    (depth: number, cardId: string) => {
      if (cardId.startsWith('korner:')) {
        const slug = cardId.slice('korner:'.length);
        const label =
          listKornerLabel(slug) ?? slug.charAt(0).toUpperCase() + slug.slice(1);
        setTrail((prev) => [
          ...prev.slice(0, depth + 1),
          { kind: 'korner', bucket: 'hub', slug, label },
        ]);
        setActiveDepth(depth + 1);
        setNodeId(null);
        return;
      }

      if (cardId === 'feed' || cardId === 'profile' || cardId === 'hub') {
        setTrail((prev) => [
          ...prev.slice(0, depth + 1),
          { kind: 'bucket', bucket: cardId },
        ]);
        setActiveDepth(depth + 1);
        setNodeId(null);
        return;
      }

      setNodeId(cardId);
    },
    [],
  );

  // Which card in a given band was the one taken onward, so the path stays
  // lit in the bands behind you.
  const selectedAt = useCallback(
    (depth: number) => {
      const next = trail[depth + 1];
      if (!next) return undefined;
      if (next.kind === 'bucket') return next.bucket;
      if (next.kind === 'korner') return `korner:${next.slug}`;
      return undefined;
    },
    [trail],
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
              {trail.map((stepEntry, i) => (
                <Fragment key={`${i}-${trailLabel(stepEntry)}`}>
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
                      i === trail.length - 1 && !selectedNode
                        ? undefined
                        : () => {
                            setTrail((prev) => prev.slice(0, i + 1));
                            setActiveDepth(i);
                            setNodeId(null);
                          }
                    }
                  >
                    {i === 0
                      ? intl.formatMessage(messages.crumbBuckets)
                      : trailLabel(stepEntry)}
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
              <Rail
                nodes={nodes}
                trail={trail}
                activeDepth={activeDepth}
                selectedAt={selectedAt}
                onSelect={handleSelect}
                onActiveDepth={setActiveDepth}
              />
            )}

            {selectedNode && (
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
