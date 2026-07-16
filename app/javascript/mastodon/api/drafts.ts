import { apiRequestGet, apiRequestPut, apiRequestDelete } from 'mastodon/api';
import type { ApiDraftJSON } from 'mastodon/api_types/drafts';

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
