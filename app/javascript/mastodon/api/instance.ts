import { apiRequestGet } from 'mastodon/api';
import type { ApiPrivacyPolicyJSON } from 'mastodon/api_types/instance';

export const apiGetPrivacyPolicy = () =>
  apiRequestGet<ApiPrivacyPolicyJSON>('v1/instance/privacy_policy');
