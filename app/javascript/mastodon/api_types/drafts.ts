import type { ApiMediaAttachmentJSON } from './media_attachments';

// A draft from any composer (/api/v1/drafts; docs/design.md, Drafts).
// `params` is whatever that composer saves; `korner` + `kind` say which
// composer, `context` what it hangs off.
export interface ApiComposerDraftJSON<P = Record<string, unknown>> {
  id: string;
  korner: string;
  kind: string;
  context: string | null;
  version: number;
  params: P;
  media_attachments: ApiMediaAttachmentJSON[];
  updated_at: string;
}
