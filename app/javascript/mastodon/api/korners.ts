import { apiRequestGet, apiRequestPost } from 'mastodon/api';
import type {
  ApiKornerJSON,
  ApiKornerSeenJSON,
} from 'mastodon/api_types/korners';

export const apiGetKorners = () => apiRequestGet<ApiKornerJSON[]>('v1/korners');

export const apiGetKorner = (slug: string) =>
  apiRequestGet<ApiKornerJSON>(`v1/korners/${slug}`);

// Mark a korner's content seen up to now (unread badge → 0). Called when
// the viewer opens the korner; answers with what that cleared. See
// Api::V1::KornersController#mark_seen.
export const apiPostKornerSeen = (slug: string) =>
  apiRequestPost<ApiKornerSeenJSON>(`v1/korners/${slug}/seen`);
