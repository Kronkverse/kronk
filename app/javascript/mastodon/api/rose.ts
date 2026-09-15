import { apiRequestGet, apiRequestPost } from 'mastodon/api';
import type { ApiRoseJSON } from 'mastodon/api_types/rose';

// Today's stack. "Today" is the Kronk day, which starts at 3am Sydney
// for everybody, so this is the same set for both ends of a rose.
export const apiGetRoses = () => apiRequestGet<ApiRoseJSON[]>('v1/rose/roses');

// Today's roses you have sent. The profile button reads this so it can
// open in the already-sent state instead of finding out by being tapped.
export const apiGetSentRoses = () =>
  apiRequestGet<ApiRoseJSON[]>('v1/rose/roses', { direction: 'sent' });

// One tap. The server refuses a non-Mate (403) and a second rose to the
// same person on the same day (409).
export const apiSendRose = (toAccountId: string) =>
  apiRequestPost<ApiRoseJSON>('v1/rose/roses', {
    to_account_id: toAccountId,
  });
