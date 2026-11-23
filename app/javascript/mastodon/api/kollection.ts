import {
  apiRequestDelete,
  apiRequestGet,
  apiRequestPatch,
  apiRequestPost,
} from 'mastodon/api';

// Kollection (docs/spaces/kollection.md): the apps linked to Kronk.
// Api::V1::Kollection::AppsController.

// What an app may ask to see of you, in the order the composer offers
// them (KollectionApp::SCOPES).
export const KOLLECTION_SCOPES = [
  'openid',
  'profile',
  'read',
  'write',
] as const;

export type KollectionScope = (typeof KOLLECTION_SCOPES)[number];

export const isKollectionScope = (value: unknown): value is KollectionScope =>
  typeof value === 'string' &&
  (KOLLECTION_SCOPES as readonly string[]).includes(value);

export interface ApiKollectionKeeperJSON {
  id: string;
  acct: string;
  username: string;
  display_name: string;
  avatar: string;
  avatar_static: string;
}

export interface ApiKollectionAppJSON {
  id: string;
  name: string;
  description: string;
  website: string | null;
  icon_url: string | null;
  // It signs people in with Kronk. Otherwise it is a link.
  signs_in: boolean;
  // What it can see of you. Empty for a link.
  scopes: string[];
  status: 'live' | 'pulled';
  // You hold a live token for it.
  connected: boolean;
  // You keep it.
  is_keeper: boolean;
  // You keep it, or you are an admin: you may see its keys, edit it and
  // remove it.
  can_manage: boolean;
  keeper: ApiKollectionKeeperJSON | null;
  created_at: string;
  // Only with can_manage.
  icon_id?: string | null;
  redirect_uris?: string[];
  // Only with can_manage, and only for an app that signs in.
  client_id?: string;
  client_secret?: string;
}

export interface SaveKollectionAppParams {
  name?: string;
  description?: string;
  website?: string | null;
  sign_in?: boolean;
  // One per line.
  redirect_uris?: string;
  scopes?: KollectionScope[];
  // An upload's id, or null to remove the icon. Omit to leave it.
  icon_id?: string | null;
}

export const apiGetKollectionApps = () =>
  apiRequestGet<ApiKollectionAppJSON[]>('v1/kollection/apps');

export const apiGetKollectionApp = (id: string) =>
  apiRequestGet<ApiKollectionAppJSON>(`v1/kollection/apps/${id}`);

export const apiCreateKollectionApp = (params: SaveKollectionAppParams) =>
  apiRequestPost<ApiKollectionAppJSON>(
    'v1/kollection/apps',
    params as unknown as Record<string, unknown>,
  );

export const apiUpdateKollectionApp = (
  id: string,
  params: SaveKollectionAppParams,
) =>
  apiRequestPatch<ApiKollectionAppJSON>(
    `v1/kollection/apps/${id}`,
    params as unknown as Record<string, unknown>,
  );

export const apiRemoveKollectionApp = (id: string) =>
  apiRequestDelete(`v1/kollection/apps/${id}`);

export const apiDisconnectKollectionApp = (id: string) =>
  apiRequestPost<ApiKollectionAppJSON>(`v1/kollection/apps/${id}/disconnect`);
