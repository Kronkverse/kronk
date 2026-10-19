import {
  apiRequestGet,
  apiRequestPost,
  apiRequestPut,
  apiRequestDelete,
} from 'mastodon/api';
import type {
  ApiComposerDraftJSON,
  ApiDraftJSON,
} from 'mastodon/api_types/drafts';

// GET returns the current draft, or null when there isn't one.
export const apiGetDraft = () => apiRequestGet<ApiDraftJSON | null>('v1/draft');

// Body type is inlined (an anonymous object type is assignable to the API
// helper's `Record<string, unknown>`, unlike a named interface).
export const apiPutDraft = (body: {
  text: string;
  spoiler_text: string;
  visibility: string;
  language: string | null;
  in_reply_to_id: string | null;
  sensitive: boolean;
  poll: {
    options: string[];
    expires_in: number;
    multiple: boolean;
    hide_totals: boolean;
  } | null;
  media_ids: string[];
}) => apiRequestPut<ApiDraftJSON>('v1/draft', body);

export const apiDeleteDraft = () => apiRequestDelete('v1/draft');

// Drafts for every composer (docs/design.md, Drafts). The single-draft
// calls above are the post composer's, until it moves onto these.

export interface DraftComposer {
  korner: string;
  kind: string;
  context?: string | null;
}

export const apiListDrafts = <P>({ korner, kind, context }: DraftComposer) =>
  apiRequestGet<ApiComposerDraftJSON<P>[]>('v1/drafts', {
    korner,
    kind,
    ...(context ? { context } : {}),
  });

// Starts a draft when `id` is null, otherwise saves over it. The composer
// never changes: korner, kind and context only count on the first save.
export const apiSaveDraft = <P>(
  id: string | null,
  composer: DraftComposer,
  body: { version: number; params: P; media_ids: string[] },
) =>
  id
    ? apiRequestPut<ApiComposerDraftJSON<P>>(`v1/drafts/${id}`, body)
    : apiRequestPost<ApiComposerDraftJSON<P>>('v1/drafts', {
        korner: composer.korner,
        kind: composer.kind,
        context: composer.context ?? null,
        ...body,
      });

export const apiDiscardDraft = (id: string) =>
  apiRequestDelete(`v1/drafts/${id}`);
