import api, {
  apiRequestGet,
  apiRequestPost,
  apiRequestPut,
  apiRequestDelete,
} from 'mastodon/api';
import type { ApiUrl } from 'mastodon/api';
import { withAudienceKrews as withKrews } from 'mastodon/api/krew';
import type {
  ApiChronicleJSON,
  ApiChronicleSeriesJSON,
  ChronicleKind,
  ChronicleSummaryJSON,
  ChronicleVisibility,
} from 'mastodon/api_types/kronikles';

interface CreateChronicleParams {
  title: string;
  body: string;
  kind?: ChronicleKind;
  visibility?: ChronicleVisibility;
  series_id?: string | null;
}

interface UpdateChronicleParams {
  title?: string;
  body?: string;
  kind?: ChronicleKind;
  visibility?: ChronicleVisibility;
  // null takes it out of its Series.
  series_id?: string | null;
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

// Series (docs/spaces/kronikles.md, Series). Backend:
// `Api::V1::Kronikles::SeriesController` and `SeriesChaptersController`.
// A Series is seen as far as its chapters are; a chapter list holds only
// the ones you can see, in reading order.
interface SeriesParams {
  title?: string;
  description?: string;
  cover_media_attachment_id?: string | null;
}

const seriesUrl = (id: string, rest = ''): ApiUrl =>
  `v1/kronikles/series/${id}${rest}`;

export const apiListMySeries = () =>
  apiRequestGet<ApiChronicleSeriesJSON[]>('v1/kronikles/series', {
    scope: 'mine',
  });

export const apiGetSeries = (id: string) =>
  apiRequestGet<ApiChronicleSeriesJSON>(seriesUrl(id));

export const apiCreateSeries = (params: SeriesParams) =>
  apiRequestPost<ApiChronicleSeriesJSON>('v1/kronikles/series', {
    series: params,
  });

export const apiUpdateSeries = (id: string, params: SeriesParams) =>
  apiRequestPut<ApiChronicleSeriesJSON>(seriesUrl(id), { series: params });

export const apiDeleteSeries = (id: string) =>
  apiRequestDelete<Record<string, never>>(seriesUrl(id));

export const apiListSeriesChapters = (id: string) =>
  apiRequestGet<ChronicleSummaryJSON[]>(seriesUrl(id, '/chapters'));

// Every chapter, once, in the new order. Answers with the new list.
export const apiReorderSeries = (id: string, chapterIds: string[]) =>
  apiRequestPut<ChronicleSummaryJSON[]>(seriesUrl(id, '/reorder'), {
    chapter_ids: chapterIds,
  });

export const apiAddSeriesChapter = (id: string, chronicleId: string) =>
  apiRequestPost<ChronicleSummaryJSON[]>(seriesUrl(id, '/chapters'), {
    chronicle_id: chronicleId,
  });

export const apiRemoveSeriesChapter = (id: string, chronicleId: string) =>
  apiRequestDelete<ChronicleSummaryJSON[]>(
    seriesUrl(id, `/chapters/${chronicleId}`),
  );

// Your own Kronikles, every chapter listed (the directory would show a
// Series once), for adding one to a Series.
export const apiListMyChronicles = () =>
  apiRequestGet<ApiChronicleJSON[]>('v1/kronikles/chronicles', {
    scope: 'mine',
    series: 'each',
    limit: 60,
  });
