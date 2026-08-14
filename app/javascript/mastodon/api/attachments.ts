import { apiRequestDelete, apiRequestGet, apiRequestPost } from 'mastodon/api';

// KornerAttachment REST surface — the cross-korner join primitive
// (docs/kronk_korner_attachments.md §3.1). Phase 2: the thin client
// wrapper. The hook (`useAttachments`) is the consumer; components
// should not talk to axios directly.

export type AttachmentKind = 'spawn' | 'link' | 'reference';

export interface AttachmentEndpointPreview {
  slug: string;
  id: string | null;
  title: string | null;
  url: string | null;
  missing?: boolean;
}

export interface ApiAttachmentJSON {
  id: string;
  source_slug: string;
  source_id: string;
  target_slug: string;
  target_id: string;
  kind: AttachmentKind;
  metadata: Record<string, unknown> | null;
  created_at: string;
  source: AttachmentEndpointPreview;
  target: AttachmentEndpointPreview;
}

// Extends `Record<string, unknown>` so it's structurally assignable to
// the shape `apiRequestPost` expects — a bare named interface would
// require an explicit index signature, and `type` aliases trip the
// project's `consistent-type-definitions` lint rule.
export interface CreateAttachmentInput extends Record<string, unknown> {
  source_slug: string;
  source_id: string;
  target_slug: string;
  target_id: string;
  // POST refuses `spawn` — framework-only. Client can create link or
  // reference attachments; spawn rows land via the factory on server
  // side (Phase 3 wiring).
  kind: Exclude<AttachmentKind, 'spawn'>;
  metadata?: Record<string, unknown>;
}

export const apiGetAttachmentsBySource = (slug: string, id: string) =>
  apiRequestGet<ApiAttachmentJSON[]>('v1/attachments', {
    source: `${slug}/${id}`,
  });

export const apiGetAttachmentsByTarget = (slug: string, id: string) =>
  apiRequestGet<ApiAttachmentJSON[]>('v1/attachments', {
    target: `${slug}/${id}`,
  });

export const apiCreateAttachment = (input: CreateAttachmentInput) =>
  apiRequestPost<ApiAttachmentJSON>('v1/attachments', input);

export const apiDeleteAttachment = (id: string) =>
  apiRequestDelete(`v1/attachments/${id}`);

// Candidate rows for `<AttachmentPicker>` — the shape mirrors
// `AttachmentEndpointPreview` (spec §3.1) but is always populated
// (no `missing` variant). The server ILIKEs `q` against title/name/
// display_name on the target korner's primary AR class and scopes to
// what the current account can see.
export interface AttachmentCandidateJSON {
  slug: string;
  id: string;
  title: string | null;
  url: string;
}

export const apiSearchAttachmentCandidates = (
  targetKorner: string,
  query: string,
  limit = 20,
) =>
  apiRequestGet<AttachmentCandidateJSON[]>('v1/attachments/candidates', {
    korner: targetKorner,
    q: query,
    limit,
  });
