import {
  apiRequest,
  apiRequestGet,
  apiRequestPost,
  apiRequestDelete,
} from 'mastodon/api';

// Klot — cycle tracker API client. Mirrors app/controllers/api/v1/klot/*.
// Phase enum matches Kronk::CyclePhase on the Ruby side.

export type Phase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';

// CycleDay::FLOWS and CycleDay::SYMPTOMS on the server.
export type Flow = 'spotting' | 'light' | 'medium' | 'heavy';
export type Symptom =
  | 'cramps'
  | 'headache'
  | 'backache'
  | 'tender_breasts'
  | 'bloating'
  | 'nausea'
  | 'tired'
  | 'energetic'
  | 'low'
  | 'anxious'
  | 'irritable'
  | 'calm'
  | 'cravings'
  | 'acne'
  | 'poor_sleep'
  | 'high_desire';

// One period: the day it started and, once logged, the day it ended.
export interface ApiKlotLogJSON {
  id: string;
  started_on: string; // ISO date
  ended_on: string | null;
  length: number | null; // days of bleeding, once it has ended
}

// How one day was. Owner-only.
export interface ApiKlotDayJSON {
  day: string; // ISO date
  flow: Flow | null;
  symptoms: Symptom[];
  note: string;
}

export interface ApiKlotNextPeriodJSON {
  expected_on: string;
  from: string;
  to: string;
  late_by: number;
}

export interface ApiKlotSelfJSON {
  day_of_cycle: number | null;
  phase: Phase | null;
  // Worked out from the log. `*_known` is false while a typical length
  // is standing in (fewer than two periods, or none with an end).
  cycle_length: number;
  cycle_known: boolean;
  period_length: number;
  period_known: boolean;
  cycles_logged: number;
  shortest_cycle: number | null;
  longest_cycle: number | null;
  bleeding: boolean;
  next_period: ApiKlotNextPeriodJSON | null;
  logs: ApiKlotLogJSON[]; // newest first
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

// `ended_on: ''` reopens a period.
export const apiPatchKlotLog = (
  id: string,
  params: { started_on?: string; ended_on?: string },
) =>
  apiRequest<ApiKlotSelfJSON>('PATCH', `v1/klot/self/logs/${id}`, {
    data: params,
  });

export const apiGetKlotDays = (from: string, to: string) =>
  apiRequestGet<ApiKlotDayJSON[]>('v1/klot/self/days', { from, to });

export const apiPutKlotDay = (
  day: string,
  entry: Pick<ApiKlotDayJSON, 'flow' | 'symptoms' | 'note'>,
) =>
  apiRequest<ApiKlotDayJSON>('PUT', `v1/klot/self/days/${day}`, {
    data: {
      flow: entry.flow ?? '',
      // An empty list does not survive the trip as form data.
      symptoms: entry.symptoms.length > 0 ? entry.symptoms : [''],
      note: entry.note,
    },
  });

// Every period and every day, gone.
export const apiClearKlotData = () =>
  apiRequestDelete<ApiKlotSelfJSON>('v1/klot/self/data');

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
