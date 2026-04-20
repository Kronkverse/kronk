import { apiRequestPost, apiRequestGet } from 'mastodon/api';
import type {
  ApiAccountJSON,
  ApiFamiliarFollowersJSON,
} from 'mastodon/api_types/accounts';
import type { ApiRelationshipJSON } from 'mastodon/api_types/relationships';
import type { ApiHashtagJSON } from 'mastodon/api_types/tags';

export const apiSubmitAccountNote = (id: string, value: string) =>
  apiRequestPost<ApiRelationshipJSON>(`v1/accounts/${id}/note`, {
    comment: value,
  });

export const apiFollowAccount = (
  id: string,
  params?: {
    reblogs: boolean;
  },
) =>
  apiRequestPost<ApiRelationshipJSON>(`v1/accounts/${id}/follow`, {
    ...params,
  });

export const apiUnfollowAccount = (id: string) =>
  apiRequestPost<ApiRelationshipJSON>(`v1/accounts/${id}/unfollow`);

export const apiRemoveAccountFromFollowers = (id: string) =>
  apiRequestPost<ApiRelationshipJSON>(
    `v1/accounts/${id}/remove_from_followers`,
  );

export const apiGetFeaturedTags = (id: string) =>
  apiRequestGet<ApiHashtagJSON>(`v1/accounts/${id}/featured_tags`);

export const apiGetEndorsedAccounts = (id: string) =>
  apiRequestGet<ApiAccountJSON>(`v1/accounts/${id}/endorsements`);

export const apiGetFamiliarFollowers = (id: string) =>
  apiRequestGet<ApiFamiliarFollowersJSON>('v1/accounts/familiar_followers', {
    id,
  });

export const apiNudgeAccount = (id: string) =>
  apiRequestPost<{ streak: number }>(`v1/accounts/${id}/nudge`);

export const apiGetNudgeStreak = (id: string) =>
  apiRequestGet<{ streak: number }>(`v1/accounts/${id}/nudge_streak`);
