import {
  apiRequestGet,
  apiRequestPost,
  apiRequestPut,
  apiRequestDelete,
} from 'mastodon/api';
import { withAudienceKrews as withKrews } from 'mastodon/api/krew';
import type {
  ArtPieceDetailsJSON,
  ApiArtPieceJSON,
  ApiArtPiecePhotoJSON,
  ApiArtPortfolioJSON,
  ArtVisibility,
  ArtKind,
} from 'mastodon/api_types/art';

interface CreatePieceParams extends Partial<ArtPieceDetailsJSON> {
  title: string;
  description?: string;
  kind?: ArtKind;
  visibility?: ArtVisibility;
  cover_media_attachment_id?: string;
}

interface UpdatePieceParams extends Partial<ArtPieceDetailsJSON> {
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

export const apiCreatePiece = (params: CreatePieceParams, krewIds?: string[]) =>
  apiRequestPost<ApiArtPieceJSON>(
    'v1/art/pieces',
    withKrews({ art_piece: params }, krewIds),
  );

export const apiUpdatePiece = (
  id: string,
  params: UpdatePieceParams,
  krewIds?: string[],
) =>
  apiRequestPut<ApiArtPieceJSON>(
    `v1/art/pieces/${id}`,
    withKrews({ art_piece: params }, krewIds),
  );

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

// An artist's portfolio, and saving your own (docs/spaces/art.md, Portfolio).
export const apiGetPortfolio = (accountId: string) =>
  apiRequestGet<ApiArtPortfolioJSON>(`v1/art/portfolios/${accountId}`);

export const apiUpdatePortfolio = (params: {
  statement?: string;
  open_for_commissions?: boolean;
  featured_ids?: string[];
  mediums?: string[];
}) => apiRequestPut<ApiArtPortfolioJSON>('v1/art/portfolio', params);
