// Kronk system notices.
//
// Korner/system notifications (proposal delivered, task assigned, …) are
// still created and served through the classic Notification model, not
// Nudges tables. They show on the Notifications face of Nudges, merged into
// the list by time and drawn by `system_notice_row.tsx`. This file says
// which types those are. They are read from the groups already loaded into
// `state.notificationGroups` (fetched at app boot) — no API of their own.
//
// Add types here as they gain a row. `proposal_challenged` and
// `task_assigned` joined on 2026-08-12: both were registered and firing since
// #391 with nothing displaying them, so they were invisible to users. See
// docs/spaces/nudges.md (Retiring legacy notifications).

import type {
  NotificationGroupEmailConfirmationReminder,
  NotificationGroupProposalChallenged,
  NotificationGroupProposalComplete,
  NotificationGroupTaskAssigned,
} from 'mastodon/models/notification_group';

export const KRONK_SYSTEM_TYPES = [
  'proposal_status_changed',
  'proposal_challenged',
  'task_assigned',
  'email_confirmation_reminder',
] as const;

// Union of every system group the Notifications face renders. Extend the
// tuple + this union together when a new type gains a row.
export type KronkSystemGroup =
  | NotificationGroupProposalComplete
  | NotificationGroupProposalChallenged
  | NotificationGroupTaskAssigned
  | NotificationGroupEmailConfirmationReminder;

const SYSTEM_TYPE_SET = new Set<string>(KRONK_SYSTEM_TYPES);

export function isKronkSystemType(type: string): boolean {
  return SYSTEM_TYPE_SET.has(type);
}
