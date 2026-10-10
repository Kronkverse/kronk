// The Nudges notifications list. Backend:
// Api::V1::Nudges::NotificationsController + Nudges::NotificationFeed.

import type { ApiAccountJSON } from './accounts';

// One row. Passive events about the same thing are rolled up across
// people on the server, so a row can stand for several actors.
export interface ApiNudgeNotificationJSON {
  // The newest event in the group.
  id: string;
  source_korner_slug: string;
  verb: string;
  source_type: string | null;
  source_id: string | null;
  interaction: 'interactive' | 'passive';
  cta_label: string | null;
  // Where a tap goes: the event's own link, else the thing it is about,
  // else the person who did it.
  route: string;
  // A short title for what it is about. Null when the source is gone, or
  // is a post the viewer may not see.
  subject: string | null;
  created_at: string;
  seen: boolean;
  // Distinct actors in the group; `actors` carries the most recent few.
  count: number;
  actors: ApiAccountJSON[];
}

export interface ApiNudgeNotificationsPage {
  notifications: ApiNudgeNotificationJSON[];
  next_before: string | null;
  unseen_count: number;
  // The server's clock when the page was built. Passed back as `up_to`
  // when marking seen, so nothing that arrived afterwards is swallowed.
  as_of: string;
}

export interface ApiNudgeUnseenCount {
  unseen_count: number;
}
