import {
  apiRequestGet,
  apiRequestPost,
  apiRequestPatch,
  apiRequestDelete,
} from 'mastodon/api';
import type { ProfileAudience } from 'mastodon/api/profile_sections';
import type {
  ApiKuestionJSON,
  ApiKuestionDailyPromptJSON,
  ApiPinnedKuestionJSON,
  ApiProfileKuestionJSON,
  KuestionAnswerFormat,
  KuestionProfileFormat,
  KuestionTileSize,
  KuestionVisibilityScope,
} from 'mastodon/api_types/kuestions';

export const apiListKuestions = () =>
  apiRequestGet<ApiKuestionJSON[]>('v2/kuestions');

// What the viewer answered plus what they asked, each with their own
// answer attached (`my_answer`).
export const apiListAnsweredKuestions = () =>
  apiRequestGet<ApiKuestionJSON[]>('v2/kuestions', { filter: 'involved' });

// Every profile Kuestion — Kronk's first, in order, then members' — each
// with the viewer's own answer.
export const apiListProfileKuestions = () =>
  apiRequestGet<ApiProfileKuestionJSON[]>('v2/kuestions', {
    filter: 'profile',
  });

export const apiGetKuestion = (id: string) =>
  apiRequestGet<ApiKuestionJSON>(`v2/kuestions/${id}`);

// The viewer opened this Kuestion's answers: none of them count as new now.
export const apiMarkKuestionSeen = (id: string) =>
  apiRequestPost(`v2/kuestions/${id}/seen`);

interface CreateKuestionParams {
  title: string;
  prompt?: string | null;
  answer_format: KuestionAnswerFormat | KuestionProfileFormat;
  mc_options?: string[];
  kind?: 'community' | 'profile';
  [key: string]: unknown;
}

export const apiCreateKuestion = (params: CreateKuestionParams) =>
  apiRequestPost<ApiKuestionJSON | ApiProfileKuestionJSON>(
    'v2/kuestions',
    params,
  );

interface AnswerKuestionParams {
  body?: string;
  choice_index?: number;
  visibility_scope?: KuestionVisibilityScope;
  [key: string]: unknown;
}

export const apiAnswerKuestion = (id: string, params: AnswerKuestionParams) =>
  apiRequestPost<ApiKuestionJSON>(`v2/kuestions/${id}/answers`, params);

// Answering a profile Kuestion pins the answer to the viewer's profile.
export const apiAnswerProfileKuestion = (
  id: string,
  params: { body: string; visibility_scope?: KuestionVisibilityScope },
) =>
  apiRequestPost<ApiProfileKuestionJSON>(`v2/kuestions/${id}/answers`, params);

interface UpdateMyAnswerParams {
  body?: string;
  visibility_scope?: KuestionVisibilityScope;
  pinned?: boolean;
  size?: KuestionTileSize;
  [key: string]: unknown;
}

export const apiUpdateMyKuestionAnswer = (
  id: string,
  params: UpdateMyAnswerParams,
) =>
  apiRequestPatch<ApiProfileKuestionJSON>(`v2/kuestions/${id}/answer`, params);

// Profile Kuestions only — a community answer can't be taken back.
export const apiRemoveMyKuestionAnswer = (id: string) =>
  apiRequestDelete<Record<string, never>>(`v2/kuestions/${id}/answer`);

// What the viewer may see of someone's pinned profile Kuestions, in their
// order. The owner sees all of their own.
export const apiGetPinnedKuestions = (
  accountId: string,
  as?: ProfileAudience,
) =>
  apiRequestGet<ApiPinnedKuestionJSON[]>('v2/kuestions/pinned', {
    account_id: accountId,
    ...(as ? { as } : {}),
  });

// Put your pinned answers in this order. Send all of them: any left out
// keep their old positions, which could then clash.
export const apiReorderPinnedKuestions = (questionIds: string[]) =>
  apiRequestPatch<Record<string, never>>('v2/kuestions/pinned', {
    question_ids: questionIds,
  });

export const apiSkipKuestion = (id: string) =>
  apiRequestPost<Record<string, never>>(`v2/kuestions/${id}/skip`);

export const apiUnskipKuestion = (id: string) =>
  apiRequestDelete<Record<string, never>>(`v2/kuestions/${id}/skip`);

export const apiGetKuestionsDailyPrompt = () =>
  apiRequestGet<ApiKuestionDailyPromptJSON>('v2/kuestions/prompt/today');
