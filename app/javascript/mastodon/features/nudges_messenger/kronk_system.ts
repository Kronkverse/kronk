// The "Kronk" system nudger.
//
// Korner/system notifications (proposal delivered, task assigned, …) are
// created and served through the classic Notification model, but the
// rebuild retired the notifications feed in favour of the Nudges
// messenger — which is Nudges::Conversation-backed and never carried
// them. So they had no visible home.
//
// This surfaces them as a single pinned "Kronk" conversation at the top
// of the messenger: messages that don't come from a person. It reads the
// groups already loaded into `state.notificationGroups` (fetched at app
// boot) — no new API or backend.
//
// Add types here as they gain a renderer (task_assigned,
// proposal_challenged are the next candidates).

import type { NotificationGroupProposalComplete } from 'mastodon/models/notification_group';

export const KRONK_SYSTEM_TYPES = ['proposal_status_changed'] as const;

// Sentinel conversation id the messenger routes to the Kronk system view
// (`/nudges/kronk`). No real Nudges::Conversation uses this id.
export const KRONK_CONVERSATION_ID = 'kronk';

// Every currently-surfaced system type has the proposal_status_changed
// group shape; widen this union as more types are added above.
export type KronkSystemGroup = NotificationGroupProposalComplete;

const SYSTEM_TYPE_SET = new Set<string>(KRONK_SYSTEM_TYPES);

export function isKronkSystemType(type: string): boolean {
  return SYSTEM_TYPE_SET.has(type);
}
