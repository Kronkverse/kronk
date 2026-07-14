// Kommons Tree — node types + client-side connection overlay.
//
// Nodes themselves now come from the API (`GET /api/v1/kommons/nodes`,
// backed by `Kronk::NodeRegistry` on the Ruby side). Connections
// (cross-branch links) are still mocked here until PR 3 wires the
// backend derivation from manifest emits/listens/feed_projection.
//
// The `KommonsNode` shape kept intact so downstream components don't
// have to know whether the data is API-hydrated or fallback.

import type { ApiKommonsNode } from 'mastodon/api/kommons_nodes';

export type Bucket = 'feed' | 'profile' | 'hub';

export type Lifecycle = 'live' | 'soon' | 'deprecated' | 'hidden';

// Cross-branch relationships between nodes. Distinct from the tree
// hierarchy (bucket → korner → page) — these jump across branches.
// Mock until PR 3 derives them from korner-manifest emits/listens/
// feed_projection.
export type LinkKind =
  | 'creates'       // node A's action creates a resource visible on node B
  | 'listed_on'     // resource from node A appears on node B
  | 'projects_to'   // node A's content projects into node B's feed
  | 'listens_to'    // node A subscribes to events emitted by node B
  | 'settings_for'  // node A configures the surface at node B
  | 'related';      // catch-all soft link

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

// ── Mock connections (PR 3 replaces with backend-derived) ──────────
// Keyed by source node id; each entry lists outgoing edges.

const MOCK_CONNECTIONS: Record<string, NodeLink[]> = {
  'feed.home': [
    { to: 'kommons.index', kind: 'projects_to', description: 'Kommons proposals appear here as Kommons cards.' },
    { to: 'booth.index', kind: 'projects_to', description: 'Booth sets appear here as space cards.' },
    { to: 'kuestions.index', kind: 'projects_to', description: 'Kuestions project into the feed as question cards.' },
  ],
  'profile.view': [
    { to: 'feed.home', kind: 'related', description: 'Statuses posted here appear in followers\u2019 home timelines.' },
    { to: 'profile.sections', kind: 'related', description: 'The sectioned view is the primary render of this profile.' },
  ],
  'profile.edit': [
    { to: 'settings.profile', kind: 'settings_for', description: 'Configures the same account attributes as classic settings.' },
  ],
  'profile.sections': [
    { to: 'settings.sections', kind: 'settings_for', description: 'Rearrange your sections in Settings \u2192 Sections.' },
    { to: 'booth.index', kind: 'listens_to', description: 'Booth sets can be surfaced as a profile section.' },
  ],
  'settings.profile': [
    { to: 'profile.edit', kind: 'settings_for', description: 'Same account attributes; new composer is the modern entry point.' },
  ],
  'settings.sections': [
    { to: 'profile.sections', kind: 'settings_for', description: 'Configures the sectioned profile render.' },
  ],
  'kommons.index': [
    { to: 'feed.home', kind: 'projects_to', description: 'Proposals project to the feed as Kommons cards.' },
    { to: 'kommons.tree', kind: 'related', description: 'Feedback proposals originate from tree nodes.' },
  ],
  'kommons.tree': [
    { to: 'kommons.index', kind: 'creates', description: 'Every planted feedback item becomes a proposal on the Kommons list.' },
  ],
  'booth.index': [
    { to: 'feed.home', kind: 'projects_to', description: 'New sets appear in the feed as Booth cards.' },
    { to: 'profile.sections', kind: 'listed_on', description: 'Booth sets can be featured as a profile section.' },
  ],
  'kalendar.index': [
    { to: 'marketplace.index', kind: 'creates', description: 'Events can list tickets on Marketplace.' },
    { to: 'huddle.index', kind: 'related', description: 'Huddles are scheduled through Kalendar and emit calendar events.' },
    { to: 'feed.home', kind: 'projects_to', description: 'RSVPed events surface in the feed.' },
  ],
  'marketplace.index': [
    { to: 'kalendar.index', kind: 'listens_to', description: 'Event ticket listings originate in Kalendar.' },
    { to: 'feed.home', kind: 'projects_to', description: 'New listings project into the feed as marketplace cards.' },
  ],
  'kuestions.index': [
    { to: 'feed.home', kind: 'projects_to', description: 'Questions and answers project to the feed.' },
  ],
  'huddle.index': [
    { to: 'kalendar.index', kind: 'listens_to', description: 'Huddle sessions surface in Kalendar as scheduled events.' },
  ],
};

// ── API → UI shape converter ───────────────────────────────────────

export const fromApiNodes = (api: ApiKommonsNode[]): KommonsNode[] =>
  api.map(n => ({
    id: n.id,
    bucket: n.bucket,
    parent: n.parent ?? undefined,
    label: n.label,
    url: n.url,
    lifecycle: n.lifecycle,
    openProposals: n.open_proposals,
    links: MOCK_CONNECTIONS[n.id],
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
  'in-flow': 'In-flow',
  groups: 'Groups',
  huddle: 'Huddle',
  kompass: 'Kompass',
  tree: 'Tree',
  moments: 'Moments',
  albutts: 'Albutts',
  klot: 'Klot',
};

export const listKorners = (nodes: KommonsNode[]): KornerSummary[] => {
  const withParent = nodes.filter((n): n is KommonsNode & { parent: string } => typeof n.parent === 'string');
  const slugs = Array.from(new Set(withParent.map(n => n.parent)));
  return slugs
    .map(slug => {
      const kornerNodes = nodes.filter(n => n.parent === slug);
      const openProposals = kornerNodes.reduce((sum, n) => sum + n.openProposals, 0);
      const anyLive = kornerNodes.some(n => n.lifecycle === 'live');
      return {
        slug,
        label: KORNER_LABELS[slug] ?? slug,
        lifecycle: anyLive ? 'live' as const : 'soon' as const,
        nodeCount: kornerNodes.length,
        openProposals,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
};

export const bucketNodes = (nodes: KommonsNode[], bucket: Bucket, kornerSlug?: string): KommonsNode[] => {
  if (bucket === 'hub') {
    if (kornerSlug) return nodes.filter(n => n.bucket === 'hub' && n.parent === kornerSlug);
    return nodes.filter(n => n.bucket === 'hub' && !n.parent);
  }
  return nodes.filter(n => n.bucket === bucket);
};

export const findNode = (nodes: KommonsNode[], id: string): KommonsNode | undefined =>
  nodes.find(n => n.id === id);

export const bucketTotals = (nodes: KommonsNode[]): Record<Bucket, number> => {
  const totals: Record<Bucket, number> = { feed: 0, profile: 0, hub: 0 };
  for (const n of nodes) totals[n.bucket] += n.openProposals;
  return totals;
};
