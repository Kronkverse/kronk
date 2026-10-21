import {
  apiRequestGet,
  apiRequestPost,
  apiRequestPut,
  apiRequestDelete,
} from 'mastodon/api';
import type {
  ApiAlbumJSON,
  ApiAlbumListItemJSON,
  ApiAlbumPhotoJSON,
  AlbumVisibility,
  AlbumContribution,
  KrewAlbumAudience,
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
  // A Krew album: made in this Krew, seen by the Krew or everyone.
  krew_id?: string;
  audience?: KrewAlbumAudience;
  description?: string;
  visibility?: AlbumVisibility;
  contribution?: AlbumContribution;
  cover_media_attachment_id?: string;
}

interface UpdateAlbumParams extends AlbumRoster {
  title?: string;
  // A Krew album only: who sees it now.
  audience?: KrewAlbumAudience;
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
  apiRequestGet<ApiAlbumListItemJSON[]>(
    'v1/albutts/albums',
    scope === 'all' ? undefined : { scope },
  );

export const apiGetAlbum = (id: string) =>
  apiRequestGet<ApiAlbumJSON>(`v1/albutts/albums/${id}`);

export const apiCreateAlbum = ({
  krew_ids,
  contributor_krew_ids,
  contributor_account_ids,
  krew_id,
  audience,
  ...album
}: CreateAlbumParams) =>
  apiRequestPost<ApiAlbumJSON>('v1/albutts/albums', {
    album,
    krew_id,
    audience,
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
    audience,
    ...album
  }: UpdateAlbumParams,
) =>
  apiRequestPut<ApiAlbumJSON>(`v1/albutts/albums/${id}`, {
    album,
    audience,
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

// What an album draft keeps (docs/spaces/albutts.md, Drafts): the new-album
// composer's fields, with captions by upload id. The photos themselves go
// as upload ids alongside (useDraft, /api/v1/drafts).
// A type alias, not an interface, so it can be sent as request data.
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type AlbumDraftParams = {
  title?: string;
  description?: string;
  visibility?: AlbumVisibility;
  contribution_open?: boolean;
  krew_ids?: string[];
  contributor_krew_ids?: string[];
  contributor_accounts?: { id: string; acct: string; display_name: string }[];
  captions?: Record<string, string>;
  // The upload picked as the new album's cover, if not the first.
  cover_media_id?: string;
};

// Asking to add photos to an album (docs/spaces/albutts.md).
export interface ApiContributionRequestJSON {
  id: string;
  created_at: string;
  account: {
    id: string;
    acct: string;
    display_name: string;
    avatar_static: string;
  };
}

export const apiAskToContribute = (albumId: string) =>
  apiRequestPost<{ id: string }>(
    `v1/albutts/albums/${albumId}/contribution_requests`,
  );

export const apiContributionRequests = (albumId: string) =>
  apiRequestGet<ApiContributionRequestJSON[]>(
    `v1/albutts/albums/${albumId}/contribution_requests`,
  );

export const apiAcceptContributionRequest = (albumId: string, id: string) =>
  apiRequestPost(
    `v1/albutts/albums/${albumId}/contribution_requests/${id}/accept`,
  );

export const apiDeclineContributionRequest = (albumId: string, id: string) =>
  apiRequestDelete(`v1/albutts/albums/${albumId}/contribution_requests/${id}`);
// Link an album you made to a Krew you're in, or unlink it
// (docs/spaces/krew.md, Linking).
// Give a personal album to a Krew you're in. One way: it is then the Krew's.
export const apiGiveAlbum = (albumId: string, krewId: string) =>
  apiRequestPost<ApiAlbumJSON>(`v1/albutts/albums/${albumId}/give`, {
    krew_id: krewId,
  });

export const apiLinkAlbumKrew = (albumId: string, krewId: string) =>
  apiRequestPost(`v1/albutts/albums/${albumId}/krews`, { krew_id: krewId });

export const apiUnlinkAlbumKrew = (albumId: string, krewId: string) =>
  apiRequestDelete(`v1/albutts/albums/${albumId}/krews/${krewId}`);
