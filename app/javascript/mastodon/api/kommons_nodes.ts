import { apiRequestGet, apiRequestPost } from 'mastodon/api';

// Kommons Tree — API client for the node registry endpoint and
// (transitively) proposal creation with a node_id tag.
//
// The node list itself is served by `GET /api/v1/kommons/nodes` and
// backed by `Kronk::NodeRegistry` on the Ruby side. Connections
// (cross-branch links) are still mocked client-side pending PR 3.

export type ApiLinkKind =
  | 'creates'
  | 'listed_on'
  | 'projects_to'
  | 'listens_to'
  | 'settings_for'
  | 'related';

export interface ApiNodeLink {
  to: string;
  kind: ApiLinkKind;
  description: string;
}

// The top-level spaces, mirroring `Kronk::NodeRegistry::BUCKETS`. Declared
// once here, at the layer closest to the server contract, and re-exported
// rather than restated — this union previously existed in three places
// (here, the Skeleton's node types, and its layout limbs) and they were
// allowed to disagree. When Ruby learned a fourth bucket, the server emitted
// nodes the client had no name for: they arrived, typechecked as impossible,
// and were drawn nowhere.
//
// This constant is still hand-synced with the Ruby side; `warnOnBucketDrift`
// (below) closes that seam at runtime — the /nodes endpoint now ships the
// registry's authoritative `buckets`, so a divergence surfaces as a console
// warning against the live contract rather than silently vanishing nodes.
export const BUCKETS = [
  'feed',
  'profile',
  'nudges',
  'hub',
  'settings',
  'kronk',
] as const;
export type Bucket = (typeof BUCKETS)[number];

// Compare the server's authoritative bucket list against this client union and
// warn on any divergence. Kept as a runtime guard (not a compile-time derive)
// on purpose: the `Bucket` union powers exhaustive `Record<Bucket, …>` maps in
// the layout engine, and that exhaustiveness is what caught the "drawn nowhere"
// bug in the first place.
export const warnOnBucketDrift = (serverBuckets: readonly string[]): void => {
  const client = new Set<string>(BUCKETS);
  const server = new Set(serverBuckets);
  const serverOnly = serverBuckets.filter((b) => !client.has(b));
  const clientOnly = [...client].filter((b) => !server.has(b));

  if (serverOnly.length > 0 || clientOnly.length > 0) {
    console.warn(
      '[kommons] bucket drift vs Kronk::NodeRegistry::BUCKETS — add the ' +
        'missing bucket(s) to api/kommons_nodes.ts BUCKETS. ' +
        `server-only (nodes drawn nowhere): [${serverOnly.join(', ')}]; ` +
        `client-only (stale): [${clientOnly.join(', ')}]`,
    );
  }
};

export interface ApiKommonsNode {
  id: string;
  bucket: Bucket;
  parent: string | null;
  label: string;
  url: string;
  route_name: string | null;
  lifecycle: 'live' | 'soon' | 'deprecated' | 'hidden';
  spa: boolean;
  open_proposals: number;
  links: ApiNodeLink[];
}

export const apiGetKommonsNodes = () =>
  apiRequestGet<{ buckets: string[]; nodes: ApiKommonsNode[] }>(
    'v1/kommons/nodes',
  );

export interface ApiCreateProposalParams {
  title: string;
  body: string;
  summary?: string;
  node_id?: string;
  proposal_type?: 'small' | 'medium' | 'large';
}

export const apiCreateKommonsProposal = (params: ApiCreateProposalParams) =>
  apiRequestPost<{ id: string; title: string; node_id: string | null }>(
    'v1/proposals',
    { proposal: params },
  );

// A proposal's steps are its tasks (open -> in_progress -> done). Add one at
// draft time (the Proposer) or later (the proposal's Kontribute tab).
export const apiCreateProposalTask = (proposalId: string, title: string) =>
  apiRequestPost<{ id: string; title: string; status: string }>(
    `v1/proposals/${proposalId}/tasks`,
    { task: { title } },
  );
