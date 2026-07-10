import { apiRequestGet, apiRequestPost, apiRequestPut, apiRequestDelete } from 'mastodon/api';

export interface ApiGroupJSON {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  discoverable: boolean;
  governance_framework: string;
  governance_threshold: number | null;
  archived: boolean;
  member_count: number;
  seeder_count: number;
  viewer_role: 'seeder' | 'member' | null;
}

export const apiGetGroups = (params: { max_id?: string; min_id?: string; limit?: number } = {}) =>
  apiRequestGet<ApiGroupJSON[]>('v1/groups', params);

export const apiGetGroup = (id: string) => apiRequestGet<ApiGroupJSON>(`v1/groups/${id}`);

export const apiCreateGroup = (params: {
  slug: string;
  name: string;
  description?: string;
  discoverable?: boolean;
  governance_framework?: string;
  governance_threshold?: number;
}) => apiRequestPost<ApiGroupJSON>('v1/groups', params);

export const apiUpdateGroup = (
  id: string,
  params: Partial<{
    name: string;
    description: string;
    discoverable: boolean;
    governance_framework: string;
    governance_threshold: number;
  }>,
) => apiRequestPut<ApiGroupJSON>(`v1/groups/${id}`, params);

export const apiArchiveGroup = (id: string) => apiRequestDelete<ApiGroupJSON>(`v1/groups/${id}`);

export const apiJoinGroup = (id: string) => apiRequestPost<ApiGroupJSON>(`v1/groups/${id}/join`, {});

export const apiLeaveGroup = (id: string) => apiRequestPost<ApiGroupJSON>(`v1/groups/${id}/leave`, {});
