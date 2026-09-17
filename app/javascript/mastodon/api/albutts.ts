import {
  apiRequestGet,
  apiRequestPost,
  apiRequestPut,
  apiRequestDelete,
} from 'mastodon/api';
import type {
  ApiAlbumJSON,
  ApiAlbumPhotoJSON,
  AlbumVisibility,
  AlbumContribution,
} from 'mastodon/api_types/albutts';

// The audience/contribution roster arrays are sent at the TOP LEVEL of the
// request (the controller reads `params[:krew_ids]` etc.), separate from the
// album attributes which go under `album: {...}`.
interface AlbumRoster {
  krew_ids?: string[]; // audience krews
  contributor_krew_ids?: string[]; // subset that also contributes
  contributor_account_ids?: string[]; // specific people who contribute
}

interface CreateAlbumParams extends AlbumRoster {
  title: string;
  description?: string;
  visibility?: AlbumVisibility;
  contribution?: AlbumContribution;
  cover_media_attachment_id?: string;
}

interface UpdateAlbumParams extends AlbumRoster {
  title?: string;
  description?: string;
  visibility?: AlbumVisibility;
  contribution?: AlbumContribution;
  cover_media_attachment_id?: string | null;
}

interface ContributePhotoParams {
  media_id: string;
  caption?: string;
}

// Directory faces on /hub/albutts. `all` is the default (every
// album the viewer can see); the others narrow that set. Backend:
// `Api::V1::Albutts::AlbumsController#index` — SCOPES constant.
export type AlbumsScope = 'all' | 'mine' | 'contributed' | 'mates';

export const apiListAlbums = (scope: AlbumsScope = 'all') =>
  apiRequestGet<ApiAlbumJSON[]>(
    'v1/albutts/albums',
    scope === 'all' ? undefined : { scope },
  );

export const apiGetAlbum = (id: string) =>
  apiRequestGet<ApiAlbumJSON>(`v1/albutts/albums/${id}`);

export const apiCreateAlbum = ({
  krew_ids,
  contributor_krew_ids,
  contributor_account_ids,
  ...album
}: CreateAlbumParams) =>
  apiRequestPost<ApiAlbumJSON>('v1/albutts/albums', {
    album,
    krew_ids,
    contributor_krew_ids,
    contributor_account_ids,
  });

export const apiUpdateAlbum = (
  id: string,
  {
    krew_ids,
    contributor_krew_ids,
    contributor_account_ids,
    ...album
  }: UpdateAlbumParams,
) =>
  apiRequestPut<ApiAlbumJSON>(`v1/albutts/albums/${id}`, {
    album,
    krew_ids,
    contributor_krew_ids,
    contributor_account_ids,
  });

export const apiDeleteAlbum = (id: string) =>
  apiRequestDelete<Record<string, never>>(`v1/albutts/albums/${id}`);

export const apiContributePhoto = (
  albumId: string,
  params: ContributePhotoParams,
) =>
  apiRequestPost<ApiAlbumPhotoJSON>(`v1/albutts/albums/${albumId}/photos`, {
    photo: params,
  });

export const apiUpdatePhoto = (photoId: string, params: { caption: string }) =>
  apiRequestPut<ApiAlbumPhotoJSON>(`v1/albutts/photos/${photoId}`, {
    photo: params,
  });

export const apiDeletePhoto = (photoId: string) =>
  apiRequestDelete<Record<string, never>>(`v1/albutts/photos/${photoId}`);
