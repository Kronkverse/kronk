import api, {
  apiRequestGet,
  apiRequestPost,
  apiRequestPut,
  apiRequestDelete,
} from 'mastodon/api';
import { withAudienceKrews as withKrews } from 'mastodon/api/krew';
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

export const apiCreateChronicle = (
  params: CreateChronicleParams,
  krewIds?: string[],
) =>
  apiRequestPost<ApiChronicleJSON>(
    'v1/kronikles/chronicles',
    withKrews({ chronicle: params }, krewIds),
  );

export const apiUpdateChronicle = (
  id: string,
  params: UpdateChronicleParams,
  krewIds?: string[],
) =>
  apiRequestPut<ApiChronicleJSON>(
    `v1/kronikles/chronicles/${id}`,
    withKrews({ chronicle: params }, krewIds),
  );

export const apiDeleteChronicle = (id: string) =>
  apiRequestDelete<Record<string, never>>(`v1/kronikles/chronicles/${id}`);

// Upload an image to place in a Kronikle's body. The body then names it as
// `![caption](picture:<id>)`, and saving the Kronikle is what ties the two
// together.
export const apiUploadChroniclePicture = async (
  file: File,
): Promise<{ id: string; preview_url: string | null }> => {
  const form = new FormData();
  form.append('file', file);
  const response = await api().post<{ id: string; preview_url: string | null }>(
    '/api/v2/media',
    form,
  );
  return response.data;
};
