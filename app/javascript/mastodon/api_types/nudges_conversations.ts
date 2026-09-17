// Nudges::Conversation-backed messenger API shapes. Backend:
// Api::V1::Nudges::ConversationsController + MessagesController.

import type { ApiAccountJSON } from './accounts';

export interface ApiNudgeKrewReadPointer {
  account_id: string;
  last_read_message_id: string;
}

export interface ApiNudgeKrewJSON {
  id: string;
  name: string;
  member_count: number;
  // Up to 2 URLs — the sidebar renders these as a stacked pair per
  // docs/kronk_nudges.md §Surface 2. Empty array on Krews with no
  // members visible to the viewer.
  avatar_urls: string[];
  // Per-member last-read pointers, excluding the viewer. Used to
  // render an M-of-N read indicator on self-authored bubbles.
  read_pointers: ApiNudgeKrewReadPointer[];
}

export interface ApiNudgeConversationJSON {
  id: string;
  kind: 'mate' | 'krew';
  last_activity_at: string | null;
  expires_at: string | null;
  unread_count: number;
  preview: string;
  latest_kind: 'message' | 'event' | null;
  muted: boolean;
  // Mate-only: the id of the last message the OTHER party read.
  // Null for Krew and when the other party hasn't read anything yet.
  other_last_read_message_id: string | null;
  other_account: ApiAccountJSON | null;
  krew: ApiNudgeKrewJSON | null;
  // A pending Krew-chat invite the viewer can accept/decline (a "request").
  request: boolean;
  invited_by: ApiAccountJSON | null;
}

export interface ApiNudgeMessageMediaJSON {
  id: string;
  type: string; // 'image' | 'video' | 'gifv' | 'audio' | 'unknown'
  url: string | null;
  preview_url: string | null;
  description: string | null;
}

export interface ApiNudgeMessageVoiceJSON {
  id: string;
  url: string | null;
  duration: number | null;
}

export interface ApiNudgeMessageJSON {
  id: string;
  conversation_id: string;
  body: string | null;
  media: ApiNudgeMessageMediaJSON[];
  voice: ApiNudgeMessageVoiceJSON | null;
  reactions: { account_id: number; symbol: string; created_at: string }[];
  created_at: string;
  deleted: boolean;
  deleted_at: string | null;
  author_is_self: boolean;
  author: ApiAccountJSON;
  // Client-only optimistic-send fields — server never emits these.
  // `sending` = optimistic row awaiting server response;
  // `failed` = POST rejected, retry affordance is shown.
  sending?: boolean;
  failed?: boolean;
}

export interface ApiNudgeEventJSON {
  id: string;
  conversation_id: string;
  source_korner_slug: string;
  verb: string;
  source_type: string | null;
  source_id: string | null;
  interaction: 'interactive' | 'passive';
  cta_label: string | null;
  cta_route: string | null;
  created_at: string;
  actor: ApiAccountJSON;
}

// The stream endpoint interleaves messages and events; each item
// carries a `kind` discriminator.
export type ApiNudgeStreamItem =
  | ({ kind: 'message' } & ApiNudgeMessageJSON)
  | ({ kind: 'event' } & ApiNudgeEventJSON);

export interface ApiNudgeConversationDetail {
  conversation: ApiNudgeConversationJSON;
  stream: ApiNudgeStreamItem[];
}
