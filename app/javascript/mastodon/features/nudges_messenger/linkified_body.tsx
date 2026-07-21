import { Fragment } from 'react';

import { Link } from 'react-router-dom';

// Autolink http(s) URLs inside a Nudges message body. Kept scoped to
// this feature — Nudges bodies are plain text, not the sanitized HTML
// blobs `<StatusContent>` handles, so the industrial-strength Status
// pipeline is overkill.
//
// Internal Kronk URLs route via react-router (soft-nav, no reload);
// external URLs open in a new tab with `noopener noreferrer`.

const URL_REGEX = /(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/gi;

const localHost = typeof window === 'undefined' ? '' : window.location.host;

// Turn a hostname into its origin (protocol + host) so we can compare
// URLs from different pages to the current host.
const isInternal = (host: string) => {
  if (!localHost) return false;
  return host === localHost;
};

// Render a URL. If it looks internal, use a Link so the router picks
// up the path; otherwise fall back to an anchor with the security-safe
// external attributes.
const renderUrl = (url: string, key: string) => {
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
    // matched http(s), so this is a belt-and-braces case (rare enough
    // that logging isn't worth it).
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
