import { apiRequestGet } from 'mastodon/api';
import type { ApiKornerJSON } from 'mastodon/api_types/korners';

export const apiGetKorners = () => apiRequestGet<ApiKornerJSON[]>('v1/korners');

export const apiGetKorner = (slug: string) =>
  apiRequestGet<ApiKornerJSON>(`v1/korners/${slug}`);
