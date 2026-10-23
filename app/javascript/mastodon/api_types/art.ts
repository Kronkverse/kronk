import type { ApiAccountJSON } from './accounts';

// Reach ladder. Matches ArtPiece#visibility in the Ruby model.
// Krew is not offered on Art in v1 (single-author korner).
export type ArtVisibility = 'public' | 'orbit' | 'mates' | 'self_only';

// Whether a piece can be had (docs/spaces/art.md, Piece details).
export type ArtAvailability =
  | 'not_for_sale'
  | 'available'
  | 'sold'
  | 'commissioned'
  | 'on_show';

export type ArtSizeUnit = 'cm' | 'in';

// What a piece is made of, how big, when, and its edition. All optional.
export interface ArtPieceDetailsJSON {
  medium: string | null;
  width: number | null;
  height: number | null;
  depth: number | null;
  size_unit: ArtSizeUnit;
  year_made: number | null;
  edition: string | null;
  availability: ArtAvailability;
}

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

export interface ApiArtPieceJSON extends ArtPieceDetailsJSON {
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
  medium?: string | null;
  availability?: ArtAvailability;
  title: string;
  kind: ArtKind;
  visibility: ArtVisibility;
  photo_count: number;
  cover_url: string | null;
  owner_acct: string;
}

// An artist's portfolio (GET /api/v1/art/portfolios/:account_id;
// docs/spaces/art.md, Portfolio). `statement` and `open_for_commissions`
// follow the profile's reach; the pieces are the ones the viewer may see.
export interface ApiArtPortfolioJSON {
  account: ApiAccountJSON;
  is_owner: boolean;
  statement: string | null;
  open_for_commissions: boolean;
  featured: ApiArtPieceJSON[];
  pieces: ApiArtPieceJSON[];
}
