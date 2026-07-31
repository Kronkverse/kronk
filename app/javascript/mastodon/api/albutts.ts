import {
  apiRequestGet,
  apiRequestPost,
  apiRequestPut,
  apiRequestDelete,
} from 'mastodon/api';
import type {
  ApiAlbumJSON,
  ApiAlbumPhotoJSON,
  ApiAlbumPhotoCommentJSON,
  AlbumVisibility,
} from 'mastodon/api_types/albutts';

interface CreateAlbumParams {
  title: string;
  description?: string;
  visibility?: AlbumVisibility;
  cover_media_attachment_id?: string;
  krew_ids?: string[];
}

interface UpdateAlbumParams {
  title?: string;
  description?: string;
  visibility?: AlbumVisibility;
  cover_media_attachment_id?: string | null;
  krew_ids?: string[];
}

interface ContributePhotoParams {
  media_id?: string;
  caption?: string;
  external_url?: string;
}

export const apiListAlbums = () =>
  apiRequestGet<ApiAlbumJSON[]>('v1/albutts/albums');

export const apiGetAlbum = (id: string) =>
  apiRequestGet<ApiAlbumJSON>(`v1/albutts/albums/${id}`);

export const apiCreateAlbum = (params: CreateAlbumParams) =>
  apiRequestPost<ApiAlbumJSON>('v1/albutts/albums', { album: params });

export const apiUpdateAlbum = (id: string, params: UpdateAlbumParams) =>
  apiRequestPut<ApiAlbumJSON>(`v1/albutts/albums/${id}`, { album: params });

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

export const apiFrothPhoto = (photoId: string) =>
  apiRequestPost<ApiAlbumPhotoJSON>(`v1/albutts/photos/${photoId}/froth`);

export const apiUnfrothPhoto = (photoId: string) =>
  apiRequestDelete<ApiAlbumPhotoJSON>(`v1/albutts/photos/${photoId}/froth`);

export const apiListPhotoComments = (photoId: string) =>
  apiRequestGet<ApiAlbumPhotoCommentJSON[]>(
    `v1/albutts/photos/${photoId}/comments`,
  );

export const apiCreatePhotoComment = (
  photoId: string,
  params: { body: string; parent_id?: string },
) =>
  apiRequestPost<ApiAlbumPhotoCommentJSON>(
    `v1/albutts/photos/${photoId}/comments`,
    { comment: params },
  );

export const apiDeletePhotoComment = (photoId: string, commentId: string) =>
  apiRequestDelete<Record<string, never>>(
    `v1/albutts/photos/${photoId}/comments/${commentId}`,
  );
