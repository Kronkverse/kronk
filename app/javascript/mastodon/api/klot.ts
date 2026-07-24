import {
  apiRequest,
  apiRequestGet,
  apiRequestPost,
  apiRequestDelete,
} from 'mastodon/api';

// Klot — cycle tracker API client. Mirrors app/controllers/api/v1/klot/*.
// Phase enum matches Kronk::CyclePhase on the Ruby side.

export type Phase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';

export interface ApiKlotLogJSON {
  id: string;
  started_on: string; // ISO date
}

export interface ApiKlotSelfJSON {
  day_of_cycle: number | null;
  phase: Phase | null;
  cycle_length: number;
  period_length: number;
  logs: ApiKlotLogJSON[];
}

export interface ApiKlotViewerJSON {
  account_id: string;
  name: string;
  handle: string;
}

export interface ApiKlotCircleEntryJSON {
  account_id: string;
  name: string;
  handle: string;
  phase: Phase | null;
}

// Self (owner)

export const apiGetKlotSelf = () =>
  apiRequestGet<ApiKlotSelfJSON>('v1/klot/self');

export const apiPostKlotLog = (startedOn?: string) =>
  apiRequestPost<ApiKlotSelfJSON>(
    'v1/klot/self/logs',
    startedOn ? { started_on: startedOn } : {},
  );

export const apiDeleteKlotLog = (id: string) =>
  apiRequestDelete<ApiKlotSelfJSON>(`v1/klot/self/logs/${id}`);

export const apiPatchKlotSettings = (params: {
  cycle_length?: number;
  period_length?: number;
}) =>
  apiRequest<ApiKlotSelfJSON>('PATCH', 'v1/klot/self/settings', {
    data: params,
  });

// Viewers (outbound allowlist)

export const apiGetKlotViewers = () =>
  apiRequestGet<ApiKlotViewerJSON[]>('v1/klot/viewers');

export const apiPostKlotViewer = (accountId: string) =>
  apiRequestPost<ApiKlotViewerJSON>('v1/klot/viewers', {
    account_id: accountId,
  });

export const apiDeleteKlotViewer = (accountId: string) =>
  apiRequestDelete(`v1/klot/viewers/${accountId}`);

// Circle (inbound projection)

export const apiGetKlotCircle = () =>
  apiRequestGet<ApiKlotCircleEntryJSON[]>('v1/klot/circle');
