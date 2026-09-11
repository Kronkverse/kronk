import {
  apiRequestGet,
  apiRequestPost,
  apiRequestPut,
  apiRequestDelete,
} from 'mastodon/api';
import type {
  ApiKarJSON,
  ApiKarPhotoJSON,
  KarVisibility,
} from 'mastodon/api_types/karporn';

interface CreateKarParams {
  title: string;
  description?: string;
  year: number;
  make: string;
  model: string;
  visibility?: KarVisibility;
  cover_media_attachment_id?: string;
  location_lat?: number;
  location_lng?: number;
  location_label?: string;
}

interface UpdateKarParams {
  title?: string;
  description?: string;
  year?: number;
  make?: string;
  model?: string;
  visibility?: KarVisibility;
  cover_media_attachment_id?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  location_label?: string | null;
}

interface AddPhotoParams {
  media_id: string;
  caption?: string;
  position?: number;
}

export type KarsScope = 'all' | 'mine' | 'mates';

export const apiListKars = (scope: KarsScope = 'all') =>
  apiRequestGet<ApiKarJSON[]>(
    'v1/karporn/kars',
    scope === 'all' ? undefined : { scope },
  );

export const apiGetKar = (id: string) =>
  apiRequestGet<ApiKarJSON>(`v1/karporn/kars/${id}`);

export const apiCreateKar = (params: CreateKarParams) =>
  apiRequestPost<ApiKarJSON>('v1/karporn/kars', { kar: params });

export const apiUpdateKar = (id: string, params: UpdateKarParams) =>
  apiRequestPut<ApiKarJSON>(`v1/karporn/kars/${id}`, { kar: params });

export const apiDeleteKar = (id: string) =>
  apiRequestDelete<Record<string, never>>(`v1/karporn/kars/${id}`);

export const apiAddPhoto = (karId: string, params: AddPhotoParams) =>
  apiRequestPost<ApiKarPhotoJSON>(`v1/karporn/kars/${karId}/photos`, {
    photo: params,
  });

export const apiDeletePhoto = (photoId: string) =>
  apiRequestDelete<Record<string, never>>(`v1/karporn/photos/${photoId}`);
