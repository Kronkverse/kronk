import { apiRequestGet } from 'mastodon/api';
import type { ApiNotificationJSON } from 'mastodon/api_types/notifications';

// Fetches the current account's legacy-typed notifications
// (mention / favourite / reblog / follow / etc.) — everything the bell
// used to surface, now scoped to the Nudges "Legacy" tab.
//
// max_id / min_id follow standard Mastodon cursor pagination on
// notification.id.
export const apiGetNudgesLegacyArchive = (
  params: {
    max_id?: string;
    min_id?: string;
    limit?: number;
  } = {},
) => apiRequestGet<ApiNotificationJSON[]>('v1/nudges/legacy', params);
