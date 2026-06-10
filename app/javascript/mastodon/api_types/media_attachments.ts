// See app/serializers/rest/media_attachment_serializer.rb

export type MediaAttachmentType =
  | 'image'
  | 'gifv'
  | 'video'
  | 'unknown'
  | 'audio';

export interface ApiMediaTagJSON {
  id: string;
  account_id: string;
  x: number;
  y: number;
  account: { display_name: string; username: string } | null;
}

export interface ApiMediaAttachmentJSON {
  id: string;
  type: MediaAttachmentType;
  url: string;
  preview_url: string;
  remoteUrl: string;
  preview_remote_url: string;
  text_url: string;
  // TODO: how to define this?
  meta: unknown;
  description?: string;
  blurhash: string;
  tags?: ApiMediaTagJSON[];
  status_id?: string | null;
  status_account_acct?: string | null;
}
