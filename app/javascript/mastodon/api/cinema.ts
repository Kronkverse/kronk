import {
  apiRequestGet,
  apiRequestPost,
  apiRequestPut,
  apiRequestDelete,
} from 'mastodon/api';
import { withAudienceKrews as withKrews } from 'mastodon/api/krew';
import type { ApiFilmJSON, FilmVisibility } from 'mastodon/api_types/cinema';

interface CreateFilmParams {
  title: string;
  description?: string;
  visibility?: FilmVisibility;
  video_media_attachment_id: string;
}

interface UpdateFilmParams {
  title?: string;
  description?: string;
  visibility?: FilmVisibility;
}

export type FilmsScope = 'all' | 'mine' | 'mates';

export const apiListFilms = (scope: FilmsScope = 'all') =>
  apiRequestGet<ApiFilmJSON[]>(
    'v1/cinema/films',
    scope === 'all' ? undefined : { scope },
  );

export const apiGetFilm = (id: string) =>
  apiRequestGet<ApiFilmJSON>(`v1/cinema/films/${id}`);

export const apiCreateFilm = (params: CreateFilmParams, krewIds?: string[]) =>
  apiRequestPost<ApiFilmJSON>(
    'v1/cinema/films',
    withKrews({ film: params }, krewIds),
  );

export const apiUpdateFilm = (
  id: string,
  params: UpdateFilmParams,
  krewIds?: string[],
) =>
  apiRequestPut<ApiFilmJSON>(
    `v1/cinema/films/${id}`,
    withKrews({ film: params }, krewIds),
  );

export const apiDeleteFilm = (id: string) =>
  apiRequestDelete<Record<string, never>>(`v1/cinema/films/${id}`);
