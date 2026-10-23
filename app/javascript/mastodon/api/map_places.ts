import {
  apiRequestDelete,
  apiRequestGet,
  apiRequestPatch,
  apiRequestPost,
} from 'mastodon/api';

// Map Places — exact spots with an address, Map's linkable record: a
// location is a Konnection to a Place (docs/spaces/map.md, Places).
// Mirrors app/controllers/api/v1/map/places_controller.rb. Every member
// sees every Place; its maker edits and deletes it.

export interface ApiMapPlaceJSON {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  url: string; // the Place's page, /hub/map/places/<id>
  maker: { id: string; acct: string; display_name: string } | null;
  is_owner: boolean;
  created_at: string;
}

export interface MapPlacesQuery extends Record<string, unknown> {
  // `<west>,<south>,<east>,<north>`
  bbox?: string;
  // `<lat>,<lng>`, with `radius_km` (default 5)
  near?: string;
  radius_km?: number;
  // name or address
  q?: string;
  limit?: number;
}

export interface MapPlaceInput extends Record<string, unknown> {
  name: string;
  address?: string | null;
  // Leave both out to have the server find the address.
  latitude?: number;
  longitude?: number;
}

export const apiGetMapPlaces = (query: MapPlacesQuery = {}) =>
  apiRequestGet<ApiMapPlaceJSON[]>('v1/map/places', query);

export const apiGetMapPlace = (id: string) =>
  apiRequestGet<ApiMapPlaceJSON>(`v1/map/places/${id}`);

export const apiCreateMapPlace = (input: MapPlaceInput) =>
  apiRequestPost<ApiMapPlaceJSON>('v1/map/places', input);

export const apiUpdateMapPlace = (id: string, input: Partial<MapPlaceInput>) =>
  apiRequestPatch<ApiMapPlaceJSON>(`v1/map/places/${id}`, input);

export const apiDeleteMapPlace = (id: string) =>
  apiRequestDelete(`v1/map/places/${id}`);
