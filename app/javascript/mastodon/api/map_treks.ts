import {
  apiRequestGet,
  apiRequestPost,
  apiRequestDelete,
} from 'mastodon/api';

// Map — Treks API client. Mirrors app/controllers/api/v1/map/treks_controller.rb.
// A trek's `route` is the already privacy-trimmed slice (or null); `distance_m`
// is the full length. Pace activities carry `pace_seconds`, speed activities
// carry `speed_kmh`.

export type TrekActivity = 'run' | 'walk' | 'hike' | 'swim' | 'ride' | 'paddle';
export type TrekState = 'draft' | 'published';
// The reach a trek can be published at (docs/kronk_feed_and_reach.md §2).
export type TrekReach = 'public' | 'orbit' | 'mates' | 'self_only';

export interface ApiTrekJSON {
  id: string;
  account_id: string;
  name: string;
  handle: string;
  activity_type: TrekActivity;
  title: string;
  label: string | null;
  recorded_at: string;
  distance_m: number;
  moving_sec: number;
  pace_seconds: number | null;
  speed_kmh: number | null;
  elevation_gain: number | null;
  trimmed_m: number;
  has_route: boolean;
  route: [number, number][] | null; // [lng, lat]
  state: TrekState;
  status_id: string | null; // the linked timeline Status, when published
  self: boolean;
}

export const apiGetTreks = () => apiRequestGet<ApiTrekJSON[]>('v1/map/treks');

export const apiGetTrek = (id: string) =>
  apiRequestGet<ApiTrekJSON>(`v1/map/treks/${id}`);

export const apiCreateTrek = (params: {
  activity_type: TrekActivity;
  title: string;
  recorded_at?: string;
  points?: [number, number][];
  label?: string;
  distance_m?: number;
  moving_sec?: number;
  pace_seconds?: number;
  speed_kmh?: number;
  elevation_gain?: number;
}) => apiRequestPost<ApiTrekJSON>('v1/map/treks', params);

export const apiPublishTrek = (id: string, visibility?: TrekReach) =>
  apiRequestPost<ApiTrekJSON>(
    `v1/map/treks/${id}/publish`,
    visibility ? { visibility } : undefined,
  );

export const apiUnpublishTrek = (id: string) =>
  apiRequestPost<ApiTrekJSON>(`v1/map/treks/${id}/unpublish`);

export const apiDeleteTrek = (id: string) =>
  apiRequestDelete(`v1/map/treks/${id}`);
