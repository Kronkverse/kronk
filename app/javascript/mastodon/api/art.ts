import {
  apiRequestGet,
  apiRequestPost,
  apiRequestPut,
  apiRequestDelete,
} from 'mastodon/api';
import type {
  ApiArtPieceJSON,
  ApiArtPiecePhotoJSON,
  ArtVisibility,
  ArtKind,
} from 'mastodon/api_types/art';

interface CreatePieceParams {
  title: string;
  description?: string;
  kind?: ArtKind;
  visibility?: ArtVisibility;
  cover_media_attachment_id?: string;
}

interface UpdatePieceParams {
  title?: string;
  description?: string;
  kind?: ArtKind;
  visibility?: ArtVisibility;
  cover_media_attachment_id?: string | null;
}

interface AddPhotoParams {
  media_id: string;
  caption?: string;
  position?: number;
}

// Directory faces on /hub/art. Backend: `Api::V1::Art::PiecesController#index`.
export type PiecesScope = 'all' | 'mine' | 'mates';

export const apiListPieces = (scope: PiecesScope = 'all') =>
  apiRequestGet<ApiArtPieceJSON[]>(
    'v1/art/pieces',
    scope === 'all' ? undefined : { scope },
  );

export const apiGetPiece = (id: string) =>
  apiRequestGet<ApiArtPieceJSON>(`v1/art/pieces/${id}`);

export const apiCreatePiece = (params: CreatePieceParams) =>
  apiRequestPost<ApiArtPieceJSON>('v1/art/pieces', { art_piece: params });

export const apiUpdatePiece = (id: string, params: UpdatePieceParams) =>
  apiRequestPut<ApiArtPieceJSON>(`v1/art/pieces/${id}`, { art_piece: params });

export const apiDeletePiece = (id: string) =>
  apiRequestDelete<Record<string, never>>(`v1/art/pieces/${id}`);

export const apiAddPhoto = (pieceId: string, params: AddPhotoParams) =>
  apiRequestPost<ApiArtPiecePhotoJSON>(`v1/art/pieces/${pieceId}/photos`, {
    photo: params,
  });

export const apiUpdatePhoto = (
  photoId: string,
  params: { caption?: string; position?: number },
) =>
  apiRequestPut<ApiArtPiecePhotoJSON>(`v1/art/photos/${photoId}`, {
    photo: params,
  });

export const apiDeletePhoto = (photoId: string) =>
  apiRequestDelete<Record<string, never>>(`v1/art/photos/${photoId}`);
