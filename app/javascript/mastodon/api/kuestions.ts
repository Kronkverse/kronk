import { apiRequestGet, apiRequestPost, apiRequestDelete } from 'mastodon/api';
import type {
  ApiKuestionJSON,
  ApiKuestionDailyPromptJSON,
  KuestionAnswerFormat,
  KuestionVisibilityScope,
} from 'mastodon/api_types/kuestions';

export const apiListKuestions = () =>
  apiRequestGet<ApiKuestionJSON[]>('v2/kuestions');

export const apiListAnsweredKuestions = () =>
  apiRequestGet<ApiKuestionJSON[]>('v2/kuestions', { filter: 'answered' });

export const apiGetKuestion = (id: string) =>
  apiRequestGet<ApiKuestionJSON>(`v2/kuestions/${id}`);

interface CreateKuestionParams {
  title: string;
  prompt?: string | null;
  answer_format: KuestionAnswerFormat;
  mc_options?: string[];
  [key: string]: unknown;
}

export const apiCreateKuestion = (params: CreateKuestionParams) =>
  apiRequestPost<ApiKuestionJSON>('v2/kuestions', params);

interface AnswerKuestionParams {
  body?: string;
  choice_index?: number;
  visibility_scope?: KuestionVisibilityScope;
  [key: string]: unknown;
}

export const apiAnswerKuestion = (id: string, params: AnswerKuestionParams) =>
  apiRequestPost<ApiKuestionJSON>(`v2/kuestions/${id}/answers`, params);

export const apiSkipKuestion = (id: string) =>
  apiRequestPost<Record<string, never>>(`v2/kuestions/${id}/skip`);

export const apiUnskipKuestion = (id: string) =>
  apiRequestDelete<Record<string, never>>(`v2/kuestions/${id}/skip`);

export const apiGetKuestionsDailyPrompt = () =>
  apiRequestGet<ApiKuestionDailyPromptJSON>('v2/kuestions/prompt/today');
