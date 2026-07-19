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
export const BUCKETS = ['feed', 'profile', 'nudges', 'hub'] as const;
export type Bucket = (typeof BUCKETS)[number];

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
  apiRequestGet<{ nodes: ApiKommonsNode[] }>('v1/kommons/nodes');

export interface ApiCreateProposalParams {
  title: string;
  body: string;
  node_id?: string;
  proposal_type?: 'small' | 'medium' | 'large';
}

export const apiCreateKommonsProposal = (params: ApiCreateProposalParams) =>
  apiRequestPost<{ id: string; title: string; node_id: string | null }>(
    'v1/proposals',
    { proposal: params },
  );
