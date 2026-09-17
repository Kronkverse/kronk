import { apiRequestGet, apiRequestPost, apiRequestDelete } from 'mastodon/api';

// Map — presence API client. Mirrors app/controllers/api/v1/map/presence_controller.rb.
// The server stores only *coarsened* coordinates, so a pin's (lat, lng) is
// already fuzzed; `radius` is the honest imprecision circle to draw.

export type MapPrecision = 'hood' | 'city';
// Presence is Mates-only now (Tal 2026-08-10): "only visible to
// mates, never Kronkverse-wide". The `kommunity` enum value stays in
// the DB for legacy rows; the API contract and the client no longer
// offer it, and PresenceController#index no longer returns pins with
// that scope.
export type MapShareScope = 'friends';

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
  // Short user-authored blurb ("Travelling China") shown on the pin
  // card. Distinct from `label`, which is the geocoded place name.
  note: string | null;
  share_scope: string;
  // ISO 8601 — set to the placement moment and only advances when the
  // coordinate changes, so the pin card's "Here since" line stays put
  // when the note is edited in place.
  placed_at: string;
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
  note?: string;
  ttl_minutes?: number;
}) => apiRequestPost<ApiPresencePinJSON>('v1/map/presence', params);

// Remove me — hard delete, nothing retained.
export const apiRemovePresence = () => apiRequestDelete('v1/map/presence');

// Geocode a typed place name via the server-side Nominatim proxy
// (Api::V1::Map::GeocodeController). Returns up to 5 candidates; the
// server caches identical queries so repeat searches don't hit the
// upstream. Attribution ("© OpenStreetMap contributors") is the
// caller's responsibility to render.
export interface ApiGeocodeResultJSON {
  label: string;
  lat: number;
  lng: number;
}

export const apiGeocodeSearch = (query: string) =>
  apiRequestGet<ApiGeocodeResultJSON[]>('v1/map/geocode', { q: query });

// Event pins — the Kalendar ↔ Map bridge. Kalendar events with a
// parseable OSM `location_url` surface on the map as spiral markers,
// filtered by the caller's visibility on the underlying Event. Powers
// the events layer on the Mates face and the `?event=<slug>` deep link
// that focuses on a specific event's pin.
export interface ApiMapEventPinJSON {
  id: string;
  slug: string;
  title: string;
  start_time: string;
  end_time: string | null;
  location_name: string | null;
  event_type: string;
  lat: number;
  lng: number;
  zoom: number | null;
  host: { acct: string; display_name: string };
  going_count: number;
}

export const apiGetMapEvents = () =>
  apiRequestGet<ApiMapEventPinJSON[]>('v1/map/events');
