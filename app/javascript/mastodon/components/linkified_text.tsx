import { Fragment } from 'react';

import { Link } from 'react-router-dom';

// Plain text with its http(s) URLs made into links: the standard for any
// description, about or bio a person typed as plain text (Kommons
// "Hyperlink in Projekt description", 2026-11-08). Links on this instance
// open in place; others open in a new tab. Nudges builds on renderUrl to
// unfurl shared posts as cards.

export const URL_REGEX = /(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/gi;

const localHost = typeof window === 'undefined' ? '' : window.location.host;

export const renderUrl = (url: string, key: string) => {
  try {
    const parsed = new URL(url);
    if (localHost && parsed.host === localHost) {
      return (
        <Link key={key} to={parsed.pathname + parsed.search + parsed.hash}>
          {url}
        </Link>
      );
    }
  } catch {
    // Malformed URL: fall through to a plain anchor.
  }
  return (
    <a key={key} href={url} target='_blank' rel='noopener noreferrer'>
      {url}
    </a>
  );
};

export const LinkifiedText: React.FC<{
  text: string;
  renderLink?: (url: string, key: string) => React.ReactNode;
}> = ({ text, renderLink = renderUrl }) => {
  const parts = text.split(URL_REGEX);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          renderLink(part, `u-${i}`)
        ) : (
          <Fragment key={`t-${i}`}>{part}</Fragment>
        ),
      )}
    </>
  );
};
