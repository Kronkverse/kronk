// Kommons Tree — node types + API → UI shape converter.
//
// Nodes AND their cross-branch connections both come from the API
// (`GET /api/v1/kommons/nodes`, backed by `Kronk::NodeRegistry` on the
// Ruby side; links auto-derived from feed_projection + declared in
// per-node `links:` blocks of the korner manifest).

import type { ApiKommonsNode, Bucket } from 'mastodon/api/kommons_nodes';
import { BUCKETS } from 'mastodon/api/kommons_nodes';

// One definition, in the API layer — see the note there. Imported as well as
// re-exported: `export { X } from` forwards a binding without introducing it
// locally, so uses below would not resolve.
export { BUCKETS };
export type { Bucket };

export type Lifecycle = 'live' | 'soon' | 'deprecated' | 'hidden';

// Cross-branch relationships between nodes. Distinct from the tree
// hierarchy (bucket → korner → page) — these jump across branches.
// Mock until PR 3 derives them from korner-manifest emits/listens/
// feed_projection.
export type LinkKind =
  | 'creates' // node A's action creates a resource visible on node B
  | 'listed_on' // resource from node A appears on node B
  | 'projects_to' // node A's content projects into node B's feed
  | 'listens_to' // node A subscribes to events emitted by node B
  | 'settings_for' // node A configures the surface at node B
  | 'related'; // catch-all soft link

export interface NodeLink {
  to: string;
  kind: LinkKind;
  description: string;
}

export interface KommonsNode {
  id: string;
  bucket: Bucket;
  parent?: string;
  label: string;
  url: string;
  lifecycle: Lifecycle;
  openProposals: number;
  links?: NodeLink[];
}

// ── API → UI shape converter ───────────────────────────────────────

export const fromApiNodes = (api: ApiKommonsNode[]): KommonsNode[] =>
  api.map((n) => ({
    id: n.id,
    bucket: n.bucket,
    parent: n.parent ?? undefined,
    label: n.label,
    url: n.url,
    lifecycle: n.lifecycle,
    openProposals: n.open_proposals,
    links: n.links.length > 0 ? n.links : undefined,
  }));

// ── Helpers (pure — take a nodes array) ────────────────────────────

export interface KornerSummary {
  slug: string;
  label: string;
  lifecycle: Lifecycle;
  nodeCount: number;
  openProposals: number;
}

const KORNER_LABELS: Record<string, string> = {
  kommons: 'Kommons',
  booth: 'Booth',
  kalendar: 'Kalendar',
  marketplace: 'Marketplace',
  kuestions: 'Kuestions',
  'inflow': 'Inflow',
  groups: 'Groups',
  huddle: 'Huddle',
  kompass: 'Kompass',
  tree: 'Tree',
  moments: 'Moments',
  albutts: 'Albutts',
  klot: 'Klot',
};

export const listKorners = (nodes: KommonsNode[]): KornerSummary[] => {
  const withParent = nodes.filter(
    (n): n is KommonsNode & { parent: string } => typeof n.parent === 'string',
  );
  const slugs = Array.from(new Set(withParent.map((n) => n.parent)));
  return slugs
    .map((slug) => {
      const kornerNodes = nodes.filter((n) => n.parent === slug);
      const openProposals = kornerNodes.reduce(
        (sum, n) => sum + n.openProposals,
        0,
      );
      const anyLive = kornerNodes.some((n) => n.lifecycle === 'live');
      return {
        slug,
        label: KORNER_LABELS[slug] ?? slug,
        lifecycle: anyLive ? ('live' as const) : ('soon' as const),
        nodeCount: kornerNodes.length,
        openProposals,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
};

export const bucketNodes = (
  nodes: KommonsNode[],
  bucket: Bucket,
  kornerSlug?: string,
): KommonsNode[] => {
  if (bucket === 'hub') {
    if (kornerSlug)
      return nodes.filter((n) => n.bucket === 'hub' && n.parent === kornerSlug);
    return nodes.filter((n) => n.bucket === 'hub' && !n.parent);
  }
  return nodes.filter((n) => n.bucket === bucket);
};

export const findNode = (
  nodes: KommonsNode[],
  id: string,
): KommonsNode | undefined => nodes.find((n) => n.id === id);

export const bucketTotals = (nodes: KommonsNode[]): Record<Bucket, number> => {
  // A literal, but one the compiler now polices: `Bucket` is derived from
  // BUCKETS, so adding a bucket makes this object fail to compile until the
  // key is added. Previously it was three keys typed against a three-member
  // union that was itself wrong — so a fourth bucket hit `undefined + n` and
  // wrote NaN under a key nobody had declared, silently, because NaN
  // propagates without throwing.
  const totals: Record<Bucket, number> = {
    feed: 0,
    profile: 0,
    nudges: 0,
    hub: 0,
  };
  for (const n of nodes) totals[n.bucket] += n.openProposals;
  return totals;
};
