import {
  apiRequestGet,
  apiRequestPost,
  apiRequestPut,
  apiRequestDelete,
} from 'mastodon/api';
import type {
  ApiChronicleJSON,
  ChronicleKind,
  ChronicleVisibility,
} from 'mastodon/api_types/kronikles';

interface CreateChronicleParams {
  title: string;
  body: string;
  kind?: ChronicleKind;
  visibility?: ChronicleVisibility;
}

interface UpdateChronicleParams {
  title?: string;
  body?: string;
  kind?: ChronicleKind;
  visibility?: ChronicleVisibility;
}

// Directory faces on /hub/kronikles. Backend:
// `Api::V1::Kronikles::ChroniclesController#index`.
export type ChroniclesScope = 'all' | 'mine' | 'mates';

export const apiListChronicles = (scope: ChroniclesScope = 'all') =>
  apiRequestGet<ApiChronicleJSON[]>(
    'v1/kronikles/chronicles',
    scope === 'all' ? undefined : { scope },
  );

export const apiGetChronicle = (id: string) =>
  apiRequestGet<ApiChronicleJSON>(`v1/kronikles/chronicles/${id}`);

export const apiCreateChronicle = (params: CreateChronicleParams) =>
  apiRequestPost<ApiChronicleJSON>('v1/kronikles/chronicles', {
    chronicle: params,
  });

export const apiUpdateChronicle = (id: string, params: UpdateChronicleParams) =>
  apiRequestPut<ApiChronicleJSON>(`v1/kronikles/chronicles/${id}`, {
    chronicle: params,
  });

export const apiDeleteChronicle = (id: string) =>
  apiRequestDelete<Record<string, never>>(`v1/kronikles/chronicles/${id}`);
