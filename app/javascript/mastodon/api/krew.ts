import {
  apiRequestGet,
  apiRequestPost,
  apiRequestPut,
  apiRequestDelete,
} from 'mastodon/api';
import type { ApiStatusJSON } from 'mastodon/api_types/statuses';

export type KrewAccess = 'open' | 'invite_only' | 'requirement_gated';
export type KrewKornerSlug =
  | 'booth'
  | 'huddle'
  | 'kalendar'
  | 'kommons'
  | 'kompass'
  | 'albutts'
  | 'kuestions';

export interface ApiKrewRequirementJSON {
  id: string;
  kind: 'attending_event' | 'located_in' | 'vouched_by_member';
  event_id?: string;
  region?: string;
  vouch_params?: Record<string, unknown>;
}

export interface ApiKrewJSON {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  access: KrewAccess;
  listed: boolean;
  discoverable: boolean;
  governance_framework: string;
  governance_threshold: number | null;
  archived: boolean;
  member_count: number;
  seeder_count: number;
  viewer_role: 'seeder' | 'member' | null;
  seeded_by_account_id: string | null;
  last_activity_at: string | null;
  // Only present in responses to the seeder; other viewers get null.
  invite_token: string | null;
  korners: KrewKornerSlug[];
  requirements: ApiKrewRequirementJSON[];
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

export interface KrewRequirementInput {
  kind: 'attending_event' | 'located_in' | 'vouched_by_member';
  event_id?: string;
  region?: string;
  vouch_params?: Record<string, unknown>;
}

export const apiCreateKrew = (params: {
  slug: string;
  name: string;
  description?: string;
  access?: KrewAccess;
  discoverable?: boolean;
  governance_framework?: string;
  governance_threshold?: number;
  korner_attachments?: KrewKornerSlug[];
  requirements?: KrewRequirementInput[];
}) => apiRequestPost<ApiKrewJSON>('v1/krews', params);

export const apiAttachKorner = (id: string, korner: KrewKornerSlug) =>
  apiRequestPost<ApiKrewJSON>(`v1/krews/${id}/attach`, { korner });

export const apiDetachKorner = (id: string, korner: KrewKornerSlug) =>
  apiRequestDelete<ApiKrewJSON>(`v1/krews/${id}/attach/${korner}`);

export const apiRegenerateInvite = (id: string) =>
  apiRequestPost<ApiKrewJSON>(`v1/krews/${id}/regenerate_invite`, {});

export const apiAddRequirement = (id: string, req: KrewRequirementInput) =>
  apiRequestPost<ApiKrewJSON>(
    `v1/krews/${id}/requirements`,
    req as unknown as Record<string, unknown>,
  );

export const apiRemoveRequirement = (id: string, requirementId: string) =>
  apiRequestDelete<ApiKrewJSON>(`v1/krews/${id}/requirements/${requirementId}`);

export const apiUpdateKrew = (
  id: string,
  params: Partial<{
    name: string;
    description: string;
    access: KrewAccess;
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
