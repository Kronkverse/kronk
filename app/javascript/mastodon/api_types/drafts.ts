import type { ApiMediaAttachmentJSON } from './media_attachments';

export interface ApiDraftPollJSON {
  options?: string[];
  expires_in?: number;
  multiple?: boolean;
  hide_totals?: boolean;
}

export interface ApiDraftParamsJSON {
  text?: string;
  spoiler_text?: string;
  visibility?: string;
  language?: string;
  in_reply_to_id?: string | null;
  sensitive?: boolean;
  poll?: ApiDraftPollJSON | null;
}

// The composer autosave buffer — one rolling draft per account
// (GET/PUT/DELETE /api/v1/draft). See Api::V1::DraftsController.
export interface ApiDraftJSON {
  id: string;
  params: ApiDraftParamsJSON;
  media_attachments: ApiMediaAttachmentJSON[];
  updated_at: string;
}
