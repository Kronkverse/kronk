import {
  apiRequestGet,
  apiRequestPost,
  apiRequestPut,
  apiRequestDelete,
} from 'mastodon/api';
import type { ApiStatusJSON } from 'mastodon/api_types/statuses';

export interface ApiKrewJSON {
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

export const apiGetKrews = (
  params: {
    max_id?: string;
    min_id?: string;
    limit?: number;
    scope?: 'mine' | 'discoverable' | 'all';
  } = {},
) => apiRequestGet<ApiKrewJSON[]>('v1/krews', params);

export const apiGetKrew = (id: string) =>
  apiRequestGet<ApiKrewJSON>(`v1/krews/${id}`);

export const apiCreateKrew = (params: {
  slug: string;
  name: string;
  description?: string;
  discoverable?: boolean;
  governance_framework?: string;
  governance_threshold?: number;
}) => apiRequestPost<ApiKrewJSON>('v1/krews', params);

export const apiUpdateKrew = (
  id: string,
  params: Partial<{
    name: string;
    description: string;
    discoverable: boolean;
    governance_framework: string;
    governance_threshold: number;
  }>,
) => apiRequestPut<ApiKrewJSON>(`v1/krews/${id}`, params);

export const apiArchiveKrew = (id: string) =>
  apiRequestDelete<ApiKrewJSON>(`v1/krews/${id}`);

export const apiJoinKrew = (id: string) =>
  apiRequestPost<ApiKrewJSON>(`v1/krews/${id}/join`, {});

export const apiLeaveKrew = (id: string) =>
  apiRequestPost<ApiKrewJSON>(`v1/krews/${id}/leave`, {});

export const apiGetKrewStatuses = (
  id: string,
  params: { max_id?: string; min_id?: string; limit?: number } = {},
) => apiRequestGet<ApiStatusJSON[]>(`v1/krews/${id}/statuses`, params);

export const apiPostKrewStatus = (
  id: string,
  params: { status: string; visibility?: string },
) => apiRequestPost<ApiStatusJSON>(`v1/krews/${id}/statuses`, params);
