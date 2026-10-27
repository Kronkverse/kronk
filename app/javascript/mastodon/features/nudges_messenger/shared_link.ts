// A link someone is sharing into a chat: the Nudge button on a post
// (`components/status/nudge_button.tsx`) and "Send in Nudges" on the share
// sheet (`components/share_sheet.tsx`) open `/nudges/with/<account>` with it
// in history state. The composer shows it above the text box and sends it as
// the message's last line, so the message renders it the way any link in a
// message renders (a post as a card, a Kronk link as its card).
//
// Spec: docs/spaces/nudges.md, Surfaces (4. Composer).

export interface SharedLink {
  url: string;
  body: string | null;
  authorName: string | null;
  authorAcct: string | null;
}

const SHARE_KEYS = [
  'attachStatusUrl',
  'attachStatusBody',
  'attachStatusAuthorName',
  'attachStatusAuthorAcct',
  'attachStatusAuthorAvatar',
] as const;

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

// The shared link carried in history state, or null when there isn't one.
export const readSharedLink = (state: unknown): SharedLink | null => {
  if (!state || typeof state !== 'object') return null;
  const s = state as Record<string, unknown>;
  const url = text(s.attachStatusUrl);
  if (!url) return null;
  return {
    url,
    body: text(s.attachStatusBody),
    authorName: text(s.attachStatusAuthorName),
    authorAcct: text(s.attachStatusAuthorAcct),
  };
};

// History state without the shared link, so a reload doesn't attach it
// again. Anything else that rode along (a Wachuneed listing) stays.
export const withoutSharedLink = (state: unknown): unknown => {
  if (!state || typeof state !== 'object') return state;
  const rest = { ...(state as Record<string, unknown>) };
  SHARE_KEYS.forEach((key) => {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete rest[key];
  });
  return Object.keys(rest).length > 0 ? rest : undefined;
};

// The message as sent: what was typed, then the link on its own line.
export const bodyWithLink = (body: string, link: SharedLink | null): string => {
  const typed = body.trim();
  if (!link) return typed;
  return typed ? `${typed}\n${link.url}` : link.url;
};
