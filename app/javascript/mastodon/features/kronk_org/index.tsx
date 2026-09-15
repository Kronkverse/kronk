/* eslint-disable @typescript-eslint/no-unnecessary-condition --
 * `cancelled` mutates in the useEffect cleanup after the async fetch
 * reads it. TS control-flow doesn't track the mutation across the
 * closure so the checks look "always truthy/falsy", but the guards
 * are load-bearing: without them setState fires after unmount. */

// /kronk — the Kronk organisation space (spec §O).
//
// Before 2026-09-14 this space rendered from a Rails view with a
// Haml-mirror of `KronkFrame`/`HubSwitcher`/`KornerSidebar`/
// `KronkMenu`/`KronkKosmos`. The mirror had drifted from the SPA
// (no starfield, bare `<a>Ж</a>` instead of the real menu, no
// shared shadows/motion tokens). This component retires the mirror:
// /kronk now mounts inside the same Frame every other space uses.
//
// Content comes from `/api/v1/kronk_pages(/:page)` — the JSON face
// of the same Markdown files under `content/kronk/`. The Rails
// `KronkController` boots the SPA shell for /kronk URLs so this
// route can claim them.
//
// The wheel itself is the shared `<KronkWheel>` primitive
// (`components/kronk_wheel.tsx`), same one /me and /settings use.
//
// Docs: docs/spaces/kronk.md.

import { useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useParams } from 'react-router-dom';

import ArticleIcon from '@/material-icons/400-24px/article.svg?react';
import GavelIcon from '@/material-icons/400-24px/gavel.svg?react';
import GroupsIcon from '@/material-icons/400-24px/groups.svg?react';
import InfoIcon from '@/material-icons/400-24px/info.svg?react';
import LockIcon from '@/material-icons/400-24px/lock.svg?react';
import MenuBookIcon from '@/material-icons/400-24px/menu_book.svg?react';
import ShieldQuestionIcon from '@/material-icons/400-24px/shield_question.svg?react';
import { apiRequestGet } from 'mastodon/api';
import { Column } from 'mastodon/components/column';
import type { IconProp } from 'mastodon/components/icon';
import {
  KronkWheel,
  KronkWheelCentre,
  KronkWheelCentreGlyph,
} from 'mastodon/components/kronk_wheel';
import type { KronkWheelSpoke } from 'mastodon/components/kronk_wheel';

const messages = defineMessages({
  loading: { id: 'kronk_org.loading', defaultMessage: 'Loading\u2026' },
  fallbackTitle: { id: 'kronk_org.title', defaultMessage: 'Kronk' },
  tagline: {
    id: 'kronk_org.tagline',
    defaultMessage: 'What Kronk is, how it works, who runs it.',
  },
  notFoundTitle: {
    id: 'kronk_org.not_found_title',
    defaultMessage: 'Page not found',
  },
  notFoundBody: {
    id: 'kronk_org.not_found_body',
    defaultMessage: 'No content at that path yet.',
  },
});

interface NavPage {
  slug: string;
  label: string;
}

// Per-page icons. Every entry is a real Material Symbol shipping in
// `app/javascript/material-icons/400-24px/`; unmapped pages (a new
// .md dropped in after this map was written) fall through to
// `InfoIcon` so the wheel keeps working without a code change.
// Consolidated 2026-09-15: `announcements` retired; `values` folded
// into `about`; `contact` folded into `contributors`.
const PAGE_ICONS: Record<string, IconProp> = {
  about: InfoIcon,
  'how-it-works': MenuBookIcon,
  contributors: GroupsIcon,
  governance: GavelIcon,
  rules: ShieldQuestionIcon,
  privacy: LockIcon,
  terms: ArticleIcon,
};

interface KronkPagePayload {
  page: string;
  title: string;
  body_html: string;
  nav_pages: NavPage[];
}

export const KronkOrgSpace: React.FC = () => {
  const intl = useIntl();
  const { page } = useParams<{ page?: string }>();
  const activePage = page ?? 'about';

  const [payload, setPayload] = useState<KronkPagePayload | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setNotFound(false);

    void (async () => {
      try {
        const res = await (page
          ? apiRequestGet<KronkPagePayload>(`v1/kronk_pages/${page}`)
          : apiRequestGet<KronkPagePayload>('v1/kronk_pages'));
        if (!cancelled) setPayload(res);
      } catch {
        if (!cancelled) setNotFound(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page]);

  // Derive the spokes inside the memo so the `?? []` allocation doesn't
  // bust the dep array on every render — `payload?.nav_pages` is a
  // stable reference across renders when the payload is unchanged.
  const spokes = useMemo<KronkWheelSpoke[]>(
    () =>
      (payload?.nav_pages ?? []).map((nav) => ({
        key: nav.slug,
        label: nav.label,
        icon: PAGE_ICONS[nav.slug] ?? InfoIcon,
        to: `/kronk/${nav.slug}`,
        active: nav.slug === activePage,
      })),
    [payload?.nav_pages, activePage],
  );

  const title = payload?.title ?? intl.formatMessage(messages.fallbackTitle);
  const columnLabel = title;

  return (
    <Column bindToDocument label={columnLabel}>
      <Helmet>
        <title>{title} — Kronk</title>
      </Helmet>

      <div className='kronk-org' role='main' aria-label={columnLabel}>
        {/* Layout mirrors /me hub + /settings hub: three-row grid
            (title / wheel-fills-remaining / article-body-below).
            The wheel centres vertically inside the 1fr row so the
            three meta hubs read as the same object at the same
            position on the page. Article body docks in row 3 — its
            first paragraph peeks above the fold on tall viewports,
            the rest scrolls into view. */}

        {/* Row 1 — space title. Frame-parasite exception matches /me
            hub; /kronk isn't a /hub/<slug> route so
            <AutoSpaceHeader> doesn't fire. Hand-rendered with the
            shared `.space-header` classes + `data-frame-header` so
            the Frame's L11 doctor recognises the legitimate <h1>. */}
        <header className='space-header kronk-org__title' data-frame-header=''>
          <h1 className='space-header__title'>{title}</h1>
          <p className='space-header__tagline'>
            <FormattedMessage {...messages.tagline} />
          </p>
        </header>

        {/* Row 2 — wheel-mount. Positioning inherited from the shared
            `.kronk-wheel-mount`, so this wheel sits at the same
            absolute Y as /me and /settings. */}
        <div className='kronk-wheel-mount'>
          <KronkWheel spokes={spokes} label='Kronk pages'>
            <KronkWheelCentre to='/kronk' ariaLabel='Kronk'>
              <KronkWheelCentreGlyph>Ж</KronkWheelCentreGlyph>
            </KronkWheelCentre>
          </KronkWheel>
        </div>

        {/* Row 3 — article body. */}
        <article className='kronk-org__body'>
          {notFound ? (
            <>
              <h2 className='kronk-org__body-heading'>
                <FormattedMessage {...messages.notFoundTitle} />
              </h2>
              <p>
                <FormattedMessage {...messages.notFoundBody} />
              </p>
            </>
          ) : payload ? (
            // body_html is server-rendered from repo-versioned Markdown by
            // Api::V1::KronkPagesController with safe_links_only. The
            // source is trusted; the renderer strips scripts.
            <div dangerouslySetInnerHTML={{ __html: payload.body_html }} />
          ) : (
            <p className='kronk-org__loading'>
              {intl.formatMessage(messages.loading)}
            </p>
          )}
        </article>
      </div>
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export -- async-components loader unwraps `.default`
export default KronkOrgSpace;
