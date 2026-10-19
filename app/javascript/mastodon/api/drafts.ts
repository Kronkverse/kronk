import {
  apiRequestGet,
  apiRequestPost,
  apiRequestPut,
  apiRequestDelete,
} from 'mastodon/api';
import type { ApiComposerDraftJSON } from 'mastodon/api_types/drafts';

// Drafts for every composer (docs/design.md, Drafts).

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
