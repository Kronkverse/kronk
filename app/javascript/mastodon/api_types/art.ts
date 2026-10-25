import type { ApiAccountJSON } from './accounts';

// Reach ladder. Matches ArtPiece#visibility in the Ruby model.
// Krew is not offered on Art in v1 (single-author korner).
export type ArtVisibility = 'public' | 'orbit' | 'mates' | 'self_only';

// What kind of work a piece is. Matches ArtPiece#kind in the Ruby model;
// the names people see are in features/art/kinds.ts.
export type ArtKind =
  | 'painting'
  | 'sculpture'
  | 'print'
  | 'drawing'
  | 'ceramic'
  | 'photograph'
  | 'other'
  | 'textile'
  | 'illustration'
  | 'collage'
  | 'mixed_media'
  | 'installation'
  | 'mural'
  | 'glass'
  | 'jewellery'
  | 'woodwork'
  | 'metalwork'
  | 'calligraphy'
  | 'papercraft';

export interface ApiArtPiecePhotoJSON {
  id: string;
  caption: string | null;
  position: number;
  url: string | null;
  created_at: string;
}

export interface ApiArtPieceJSON {
  id: string;
  title: string;
  description: string | null;
  kind: ArtKind;
  visibility: ArtVisibility;
  photo_count: number;
  cover_url: string | null;
  is_owner: boolean;
  created_at: string;
  owner: ApiAccountJSON;
  photos: ApiArtPiecePhotoJSON[];
}

export interface ArtPieceSummaryJSON {
  id: string;
  title: string;
  kind: ArtKind;
  visibility: ArtVisibility;
  photo_count: number;
  cover_url: string | null;
  owner_acct: string;
}
