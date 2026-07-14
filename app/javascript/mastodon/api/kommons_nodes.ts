import { apiRequestGet, apiRequestPost } from 'mastodon/api';

// Kommons Tree — API client for the node registry endpoint and
// (transitively) proposal creation with a node_id tag.
//
// The node list itself is served by `GET /api/v1/kommons/nodes` and
// backed by `Kronk::NodeRegistry` on the Ruby side. Connections
// (cross-branch links) are still mocked client-side pending PR 3.

export interface ApiKommonsNode {
  id: string;
  bucket: 'feed' | 'profile' | 'hub';
  parent: string | null;
  label: string;
  url: string;
  route_name: string | null;
  lifecycle: 'live' | 'soon' | 'deprecated' | 'hidden';
  spa: boolean;
  open_proposals: number;
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
