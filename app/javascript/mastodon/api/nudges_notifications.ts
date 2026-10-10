import { apiRequestGet, apiRequestPost } from 'mastodon/api';
import type {
  ApiNudgeNotificationsPage,
  ApiNudgeUnseenCount,
} from 'mastodon/api_types/nudges_notifications';

export const apiListNudgeNotifications = (before?: string) =>
  apiRequestGet<ApiNudgeNotificationsPage>(
    'v1/nudges/notifications',
    before ? { before } : {},
  );

export const apiGetNudgeUnseenCount = () =>
  apiRequestGet<ApiNudgeUnseenCount>('v1/nudges/notifications/unseen_count');

export const apiMarkNudgeNotificationsSeen = (upTo?: string) =>
  apiRequestPost<ApiNudgeUnseenCount>(
    'v1/nudges/notifications/seen',
    upTo ? { up_to: upTo } : {},
  );
