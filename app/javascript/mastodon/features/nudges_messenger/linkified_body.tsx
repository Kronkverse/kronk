import { Fragment } from 'react';

import { Link } from 'react-router-dom';

import { InlineStatusCard } from './inline_status_card';

// Autolink http(s) URLs inside a Nudges message body. Kept scoped to
// this feature — Nudges bodies are plain text, not the sanitized HTML
// blobs `<StatusContent>` handles, so the industrial-strength Status
// pipeline is overkill.
//
// - Internal Kronk status URLs unfurl into an inline post-share card
//   (brief §Surface 3, "Post-share cards render a shared Status as a
//   proper card, not a raw link").
// - Other internal URLs route via react-router `Link` (soft-nav).
// - External URLs open in a new tab with `noopener noreferrer`.

const URL_REGEX = /(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/gi;

// Match `/@handle/12345` — the local status route registered in
// config/routes.rb (`short_account_status`). The id segment is a
// numeric snowflake; that's what the API expects on `GET /statuses/:id`.
const STATUS_PATH_REGEX = /^\/@[^/]+\/(\d+)\/?$/;

const localHost = typeof window === 'undefined' ? '' : window.location.host;

const isInternal = (host: string) => {
  if (!localHost) return false;
  return host === localHost;
};

// If the URL points at a local status, return the snowflake id;
// otherwise null.
const extractLocalStatusId = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    if (!isInternal(parsed.host)) return null;
    const match = STATUS_PATH_REGEX.exec(parsed.pathname);
    return match ? (match[1] ?? null) : null;
  } catch {
    return null;
  }
};

// Render a URL. Local status URLs unfurl into InlineStatusCard; other
// internal URLs use Link; external URLs use `<a target=_blank>`.
const renderUrl = (url: string, key: string) => {
  const statusId = extractLocalStatusId(url);
  if (statusId) {
    return <InlineStatusCard key={key} statusId={statusId} />;
  }
  try {
    const parsed = new URL(url);
    if (isInternal(parsed.host)) {
      return (
        <Link key={key} to={parsed.pathname + parsed.search + parsed.hash}>
          {url}
        </Link>
      );
    }
  } catch {
    // Malformed URL — fall through to a plain anchor. The regex already
    // matched http(s), so this is a belt-and-braces case.
  }
  return (
    <a key={key} href={url} target='_blank' rel='noopener noreferrer'>
      {url}
    </a>
  );
};

export const LinkifiedBody: React.FC<{ body: string }> = ({ body }) => {
  const parts = body.split(URL_REGEX);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          return renderUrl(part, `u-${i}`);
        }
        return <Fragment key={`t-${i}`}>{part}</Fragment>;
      })}
    </>
  );
};
