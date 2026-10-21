import { useEffect, useState } from 'react';

import { FormattedDate } from 'react-intl';

import { Link } from 'react-router-dom';

import type { ApiLinkPreview } from 'mastodon/api/link_previews';
import { apiLinkPreviews } from 'mastodon/api/link_previews';
import { useKorner } from 'mastodon/hooks/useKorner';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

import { Icon } from './icon';
import {
  CardBadge,
  CardBody,
  CardMedia,
  CardMeta,
  CardTitle,
  StandardCard,
} from './standard_card';

// KronkLinkCard: what a link to something on Kronk shows wherever it's
// shared, in a post, a Nudges message or FreeTheDream Talk (Tal,
// 2026-10-19). The thing is looked up as the person viewing
// (GET /api/v1/link_previews, app/lib/kronk/link_preview.rb), so it shows
// its title, picture and a line about it only to people who can see it;
// anyone else, and a link to a korner itself, gets the korner's own card.
// Built on <StandardCard>: the korner is the badge, the picture the media,
// a date the meta, the line the body.

const HUB = /^\/hub\/([a-z0-9-]+)(?:\/|$)/;

// The path of a link to Kronk (this site, or a bare /hub path), or null.
export const kronkPath = (href: string): string | null => {
  try {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return HUB.test(url.pathname) ? url.pathname.replace(/\/$/, '') : null;
  } catch {
    return null;
  }
};

// The Kronk links in some HTML (a post's content), in order, each once.
export const kronkPathsIn = (html: string): string[] => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const paths = Array.from(doc.querySelectorAll('a[href]'))
    .filter(
      (a) =>
        !a.classList.contains('mention') && !a.classList.contains('hashtag'),
    )
    .map((a) => kronkPath(a.getAttribute('href') ?? ''));
  return [...new Set(paths.filter((p): p is string => p !== null))];
};

// The Kronk links in plain text (a message), in order, each once.
export const kronkPathsInText = (text: string): string[] => {
  const found =
    text.match(/https?:\/\/[^\s<>"]+|(?<![\w/])\/hub\/[^\s<>"]+/g) ?? [];
  const paths = found.map((href) => kronkPath(href.replace(/[.,!?)]+$/, '')));
  return [...new Set(paths.filter((p): p is string => p !== null))];
};

// Previews are asked for together: every card that mounts in the same tick
// goes in one request, and an answer is kept for the rest of the visit.
const known = new Map<string, Promise<ApiLinkPreview | null>>();
let waiting: {
  path: string;
  resolve: (preview: ApiLinkPreview | null) => void;
}[] = [];

const BATCH = 10;

const flush = () => {
  const batch = waiting;
  waiting = [];
  for (let i = 0; i < batch.length; i += BATCH) {
    const part = batch.slice(i, i + BATCH);
    apiLinkPreviews(part.map((w) => w.path))
      .then((rows) => {
        const byUrl = new Map(rows.map((row) => [row.url, row.preview]));
        part.forEach((w) => {
          w.resolve(byUrl.get(w.path) ?? null);
        });
      })
      .catch(() => {
        part.forEach((w) => {
          known.delete(w.path);
          w.resolve(null);
        });
      });
  }
};

const previewOf = (path: string) => {
  let preview = known.get(path);
  if (!preview) {
    preview = new Promise((resolve) => {
      if (waiting.length === 0) queueMicrotask(flush);
      waiting.push({ path, resolve });
    });
    known.set(path, preview);
  }
  return preview;
};

const usePreview = (path: string) => {
  const [state, setState] = useState<{
    path: string;
    preview: ApiLinkPreview | null;
  } | null>(null);

  useEffect(() => {
    let live = true;
    void previewOf(path).then((preview) => {
      if (live) setState({ path, preview });
    });
    return () => {
      live = false;
    };
  }, [path]);

  return state?.path === path ? state : null;
};

export const KronkLinkCard: React.FC<{ path: string; className?: string }> = ({
  path,
  className,
}) => {
  const slug = HUB.exec(path)?.[1];
  const korner = useKorner(slug);
  const icon = useKornerIcon(slug);
  const loaded = usePreview(path);

  // Not a korner, or still asking: nothing yet, rather than a card that
  // changes under the reader.
  if (!korner || !loaded) return null;

  const preview = loaded.preview;
  const title = preview?.title ?? korner.name;
  const summary = preview ? preview.summary : (korner.tagline ?? null);

  return (
    <StandardCard
      as={Link}
      to={preview?.url ?? path}
      variant='flow'
      className={className ? `kronk-link-card ${className}` : 'kronk-link-card'}
    >
      {preview?.image && (
        <CardMedia>
          <img src={preview.image} alt='' loading='lazy' />
        </CardMedia>
      )}
      <CardBadge>
        <Icon id={`korner-${korner.slug}`} icon={icon} />
        {korner.name}
      </CardBadge>
      <CardTitle>{title}</CardTitle>
      {preview?.when && (
        <CardMeta>
          <FormattedDate
            value={preview.when}
            weekday='short'
            day='numeric'
            month='short'
            hour='numeric'
            minute='2-digit'
          />
        </CardMeta>
      )}
      {summary && <CardBody>{summary}</CardBody>}
    </StandardCard>
  );
};

// Cards for each Kronk link, up to `max`, for a surface that has the
// links already.
export const KronkLinkCards: React.FC<{
  paths: string[];
  max?: number;
  className?: string;
}> = ({ paths, max = 2, className }) => {
  if (paths.length === 0) return null;
  return (
    <div
      className={
        className ? `kronk-link-cards ${className}` : 'kronk-link-cards'
      }
    >
      {paths.slice(0, max).map((path) => (
        <KronkLinkCard key={path} path={path} />
      ))}
    </div>
  );
};
