// Nudges::Conversation-backed messenger API shapes. Backend:
// Api::V1::Nudges::ConversationsController + MessagesController.

import type { ApiAccountJSON } from './accounts';

export interface ApiNudgeKrewJSON {
  id: string;
  name: string;
  member_count: number;
}

export interface ApiNudgeConversationJSON {
  id: string;
  kind: 'mate' | 'krew';
  last_activity_at: string | null;
  expires_at: string | null;
  unread_count: number;
  preview: string;
  latest_kind: 'message' | 'event' | null;
  other_account: ApiAccountJSON | null;
  krew: ApiNudgeKrewJSON | null;
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
  media: ApiNudgeMessageMediaJSON | null;
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
