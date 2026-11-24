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

// The details an app's page lists (KollectionApp::CATEGORIES, PLATFORMS).
export const KOLLECTION_CATEGORIES = [
  'wellbeing',
  'social',
  'creative',
  'learning',
  'tools',
  'games',
  'other',
] as const;

export type KollectionCategory = (typeof KOLLECTION_CATEGORIES)[number];

export const isKollectionCategory = (
  value: unknown,
): value is KollectionCategory =>
  typeof value === 'string' &&
  (KOLLECTION_CATEGORIES as readonly string[]).includes(value);

export const KOLLECTION_PLATFORMS = ['web', 'android', 'ios'] as const;

export type KollectionPlatform = (typeof KOLLECTION_PLATFORMS)[number];

export const isKollectionPlatform = (
  value: unknown,
): value is KollectionPlatform =>
  typeof value === 'string' &&
  (KOLLECTION_PLATFORMS as readonly string[]).includes(value);

export interface ApiKollectionScreenshotJSON {
  id: string;
  url: string;
  preview_url: string;
  description: string | null;
}

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
  // Its page is /hub/kollection/<slug> (pages are reached by name).
  slug: string;
  name: string;
  tagline: string;
  description: string;
  website: string | null;
  // Where to get it for a phone: an app store, or the file itself.
  download_url: string | null;
  made_by: string;
  category: string | null;
  platforms: string[];
  icon_url: string | null;
  cover_url: string | null;
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
  // One app's page only: its screenshots in order, and your Mates who use
  // it (never anyone else; empty for a link).
  screenshots?: ApiKollectionScreenshotJSON[];
  mates_using?: ApiKollectionKeeperJSON[];
  // Only with can_manage.
  icon_id?: string | null;
  cover_id?: string | null;
  redirect_uris?: string[];
  // Only with can_manage, and only for an app that signs in.
  client_id?: string;
  client_secret?: string;
}

export interface SaveKollectionAppParams {
  name?: string;
  tagline?: string;
  description?: string;
  website?: string | null;
  download_url?: string | null;
  made_by?: string;
  category?: KollectionCategory | null;
  platforms?: KollectionPlatform[];
  // Upload ids in order. Omit to leave the screenshots.
  screenshot_ids?: string[];
  cover_id?: string | null;
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

// Kollection's one setting, stored the standard korner way
// (/api/v1/korners/kollection/settings): whether your Mates see which apps
// you use. On unless turned off.
export const SHOW_MATES_SETTING = 'show_mates_apps';

interface KornerSettingsPayload {
  values: Record<string, unknown>;
}

export const apiGetShowMatesApps = async () => {
  const payload = await apiRequestGet<KornerSettingsPayload>(
    'v1/korners/kollection/settings',
  );
  return payload.values[SHOW_MATES_SETTING] !== false;
};

export const apiSetShowMatesApps = async (value: boolean) => {
  const payload = await apiRequestPatch<KornerSettingsPayload>(
    `v1/korners/kollection/settings/${SHOW_MATES_SETTING}`,
    { value },
  );
  return payload.values[SHOW_MATES_SETTING] !== false;
};
