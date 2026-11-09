import { LinkifiedText, renderUrl } from 'mastodon/components/linkified_text';

import { InlineStatusCard } from './inline_status_card';

// Autolink a Nudges message body (plain text) with the shared
// <LinkifiedText>, plus one extra: an internal Kronk status URL unfurls
// into an inline post-share card (brief §Surface 3, "Post-share cards
// render a shared Status as a proper card, not a raw link").

// Match `/@handle/12345` — the local status route registered in
// config/routes.rb (`short_account_status`). The id segment is a
// numeric snowflake; that's what the API expects on `GET /statuses/:id`.
const STATUS_PATH_REGEX = /^\/@[^/]+\/(\d+)\/?$/;

const extractLocalStatusId = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    if (typeof window === 'undefined' || parsed.host !== window.location.host)
      return null;
    const match = STATUS_PATH_REGEX.exec(parsed.pathname);
    return match ? (match[1] ?? null) : null;
  } catch {
    return null;
  }
};

const renderNudgeUrl = (url: string, key: string) => {
  const statusId = extractLocalStatusId(url);
  if (statusId) return <InlineStatusCard key={key} statusId={statusId} />;
  return renderUrl(url, key);
};

export const LinkifiedBody: React.FC<{ body: string }> = ({ body }) => (
  <LinkifiedText text={body} renderLink={renderNudgeUrl} />
);
