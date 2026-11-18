import { apiRequestDelete, apiRequestGet } from 'mastodon/api';

// Live location from Anthemos — mirrors
// app/controllers/api/v1/map/live_controller.rb and
// app/controllers/api/v1/anthemos/links_controller.rb. Starting a share and
// sending points happen on the phone, signed with its key; the web only
// shows them and stops them.

export interface ApiLivePersonJSON {
  account_id: string;
  name: string;
  handle: string;
  avatar: string;
}

// A Mate sharing exactly where they are with you, and their latest point.
export interface ApiLiveLocationJSON extends ApiLivePersonJSON {
  id: string;
  lat: number;
  lng: number;
  accuracy: number; // metres, as the phone reported it
  at: string; // ISO 8601, when the phone took the point
  expires_at: string; // ISO 8601, when the share ends
  signed: boolean;
}

// One of your own shares running now.
export interface ApiOwnLiveShareJSON {
  id: string;
  link_id: string;
  device_name: string;
  recipients: ApiLivePersonJSON[];
  expires_at: string;
}

// A phone linked to your account.
export interface ApiAnthemosLinkJSON {
  id: string;
  device_name: string;
  created_at: string;
  last_used_at: string | null;
  live_shares: number;
}

export const apiGetLiveLocations = () =>
  apiRequestGet<ApiLiveLocationJSON[]>('v1/map/live');

export const apiGetOwnLiveShares = () =>
  apiRequestGet<ApiOwnLiveShareJSON[]>('v1/map/live/mine');

export const apiStopLiveShare = (id: string) =>
  apiRequestDelete(`v1/map/live/${id}`);

export const apiGetAnthemosLinks = () =>
  apiRequestGet<ApiAnthemosLinkJSON[]>('v1/anthemos/links');

export const apiUnlinkAnthemos = (id: string) =>
  apiRequestDelete(`v1/anthemos/links/${id}`);
