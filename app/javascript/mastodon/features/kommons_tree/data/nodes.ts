// Kommons Tree — mock node data.
//
// In the real system, this list is auto-derived from Rails routes +
// korner manifests + the SPA router config. See
// docs/kronk_korner_spec.md and portal-me's kronk-tree-vision brief.
//
// The mock stands in until the backend node registry ships. Every
// entry here declares:
//   - `id`      stable node identity (route name or korner slug + subpath).
//               Feedback follows the id across URL changes.
//   - `bucket`  which top-level surface the node lives in.
//   - `parent`  optional korner slug for Hub nodes (drives step-2 grouping).
//   - `label`   display name.
//   - `url`     canonical URL as a display attribute; NOT the identity key.
//   - `lifecycle` node status; drives badge + which nodes are pickable.
//   - `openProposals` mock count of open feedback proposals; API-backed later.

export type Bucket = 'feed' | 'profile' | 'hub';

export type Lifecycle = 'live' | 'soon' | 'deprecated' | 'hidden';

export interface KommonsNode {
  id: string;
  bucket: Bucket;
  parent?: string;
  label: string;
  url: string;
  lifecycle: Lifecycle;
  openProposals: number;
}

export const NODES: KommonsNode[] = [
  // ── FEED ──────────────────────────────────────────────────────────
  { id: 'feed.home',        bucket: 'feed', label: 'Home timeline',     url: '/home',              lifecycle: 'live', openProposals: 4 },
  { id: 'feed.nudges',      bucket: 'feed', label: 'Nudges activity',   url: '/nudges/activity',   lifecycle: 'live', openProposals: 1 },

  // ── PROFILE ───────────────────────────────────────────────────────
  { id: 'profile.view',        bucket: 'profile', label: 'Someone\u2019s profile',  url: '/@:user',                       lifecycle: 'live', openProposals: 7 },
  { id: 'profile.edit',        bucket: 'profile', label: 'Profile composer',        url: '/@:user/edit',                  lifecycle: 'live', openProposals: 2 },
  { id: 'profile.sections',    bucket: 'profile', label: 'Sectioned profile',       url: '/@:user/profile',               lifecycle: 'live', openProposals: 3 },
  { id: 'profile.media',       bucket: 'profile', label: 'Media',                   url: '/@:user/media',                 lifecycle: 'live', openProposals: 0 },
  { id: 'profile.connections', bucket: 'profile', label: 'Connections',             url: '/@:user/connections',           lifecycle: 'live', openProposals: 1 },
  { id: 'settings.profile',    bucket: 'profile', label: 'Settings \u00b7 Profile', url: '/settings/profile',             lifecycle: 'live', openProposals: 0 },
  { id: 'settings.sections',   bucket: 'profile', label: 'Settings \u00b7 Sections',url: '/settings/profile_sections',    lifecycle: 'live', openProposals: 1 },
  { id: 'settings.prefs',      bucket: 'profile', label: 'Preferences',             url: '/settings/preferences',         lifecycle: 'live', openProposals: 5 },

  // ── HUB ───────────────────────────────────────────────────────────
  { id: 'hub.landing',    bucket: 'hub',                    label: 'Hub grid',       url: '/hub',                       lifecycle: 'live',      openProposals: 2 },

  // Kommons
  { id: 'kommons.index',  bucket: 'hub', parent: 'kommons', label: 'Proposals',      url: '/hub/kommons',               lifecycle: 'live',      openProposals: 3 },
  { id: 'kommons.tree',   bucket: 'hub', parent: 'kommons', label: 'Tree (this)',    url: '/hub/kommons/tree',          lifecycle: 'soon',      openProposals: 0 },

  // Booth
  { id: 'booth.index',    bucket: 'hub', parent: 'booth',   label: 'Booth home',     url: '/hub/booth',                 lifecycle: 'live',      openProposals: 8 },
  { id: 'booth.set',      bucket: 'hub', parent: 'booth',   label: 'A booth set',    url: '/hub/booth/sets/:id',        lifecycle: 'live',      openProposals: 2 },

  // Kalendar
  { id: 'kalendar.index', bucket: 'hub', parent: 'kalendar',label: 'Kalendar',       url: '/hub/kalendar',              lifecycle: 'live',      openProposals: 1 },

  // Marketplace
  { id: 'market.index',   bucket: 'hub', parent: 'marketplace', label: 'Marketplace',url: '/hub/marketplace',           lifecycle: 'live',      openProposals: 4 },

  // Kuestions
  { id: 'kuestions.index',bucket: 'hub', parent: 'kuestions',label: 'Kuestions',     url: '/hub/kuestions',             lifecycle: 'live',      openProposals: 0 },

  // In-flow
  { id: 'inflow.index',   bucket: 'hub', parent: 'in-flow', label: 'In-flow',        url: '/hub/in-flow',               lifecycle: 'live',      openProposals: 1 },

  // Groups
  { id: 'groups.index',   bucket: 'hub', parent: 'groups',  label: 'Groups',         url: '/hub/groups',                lifecycle: 'live',      openProposals: 0 },

  // Huddle
  { id: 'huddle.index',   bucket: 'hub', parent: 'huddle',  label: 'Huddle',         url: '/hub/huddle',                lifecycle: 'live',      openProposals: 2 },

  // Kompass
  { id: 'kompass.index',  bucket: 'hub', parent: 'kompass', label: 'Kompass (map)',  url: '/hub/kompass',               lifecycle: 'soon',      openProposals: 0 },

  // Tree korner (separate from the kommons-tree feature)
  { id: 'tree.index',     bucket: 'hub', parent: 'tree',    label: 'Tree',           url: '/hub/tree',                  lifecycle: 'soon',      openProposals: 0 },

  // Stubs
  { id: 'moments.index',  bucket: 'hub', parent: 'moments', label: 'Moments',        url: '/hub/moments',               lifecycle: 'soon',      openProposals: 0 },
  { id: 'albutts.index',  bucket: 'hub', parent: 'albutts', label: 'Albutts',        url: '/hub/albutts',               lifecycle: 'soon',      openProposals: 0 },
];

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
};

export const listKorners = (): KornerSummary[] => {
  const withParent = NODES.filter((n): n is KommonsNode & { parent: string } => typeof n.parent === 'string');
  const slugs = Array.from(new Set(withParent.map(n => n.parent)));
  return slugs
    .map(slug => {
      const kornerNodes = NODES.filter(n => n.parent === slug);
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

export const bucketNodes = (bucket: Bucket, kornerSlug?: string): KommonsNode[] => {
  if (bucket === 'hub') {
    if (kornerSlug) return NODES.filter(n => n.bucket === 'hub' && n.parent === kornerSlug);
    return NODES.filter(n => n.bucket === 'hub' && !n.parent);
  }
  return NODES.filter(n => n.bucket === bucket);
};

export const findNode = (id: string): KommonsNode | undefined => NODES.find(n => n.id === id);

export const bucketTotals = (): Record<Bucket, number> => {
  const totals: Record<Bucket, number> = { feed: 0, profile: 0, hub: 0 };
  for (const n of NODES) totals[n.bucket] += n.openProposals;
  return totals;
};
