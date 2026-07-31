import { apiRequestGet, apiRequestPost, apiRequestDelete } from 'mastodon/api';

// Map — presence API client. Mirrors app/controllers/api/v1/map/presence_controller.rb.
// The server stores only *coarsened* coordinates, so a pin's (lat, lng) is
// already fuzzed; `radius` is the honest imprecision circle to draw.

export type MapPrecision = 'hood' | 'city';
export type MapShareScope = 'friends' | 'kommunity';

export interface ApiPresencePinJSON {
  account_id: string;
  name: string;
  handle: string;
  avatar: string; // static avatar URL — drawn in the people strip
  lat: number;
  lng: number;
  precision: MapPrecision;
  radius: number; // metres — the visible fuzz circle
  label: string | null;
  share_scope: string;
  expires_at: string; // ISO 8601
  self: boolean;
}

// Pins visible to me right now (Mates-gated projection).
export const apiGetPresence = () =>
  apiRequestGet<ApiPresencePinJSON[]>('v1/map/presence');

// My own pin, or null if I'm not on the map.
export const apiGetSelfPresence = () =>
  apiRequestGet<ApiPresencePinJSON | null>('v1/map/presence/self');

// Place (or re-place) me. The raw coordinate is coarsened server-side before
// it is stored — this sends the browser's reading, the server keeps only the
// fuzzed point.
export const apiPlacePresence = (params: {
  lat: number;
  lng: number;
  precision: MapPrecision;
  share_scope?: MapShareScope;
  label?: string;
  ttl_minutes?: number;
}) => apiRequestPost<ApiPresencePinJSON>('v1/map/presence', params);

// Remove me — hard delete, nothing retained.
export const apiRemovePresence = () => apiRequestDelete('v1/map/presence');
