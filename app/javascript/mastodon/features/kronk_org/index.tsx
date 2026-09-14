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
// Docs: docs/spaces/kronk.md.

import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import classNames from 'classnames';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';

import { apiRequestGet } from 'mastodon/api';
import { Column } from 'mastodon/components/column';

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

  const navPages = payload?.nav_pages ?? [];
  const angleFor = useCallback(
    (index: number) =>
      navPages.length === 0 ? 0 : (index / navPages.length) * 360,
    [navPages.length],
  );

  // React applies inline `style` as element properties (not a `style`
  // attribute), which bypasses CSP `style-src` — so we pass the per-spoke
  // `--spoke-angle` directly, unlike the retired Rails view which had to
  // emit a nonced <style> block for the same custom property.
  const title = payload?.title ?? intl.formatMessage(messages.fallbackTitle);
  const columnLabel = title;

  return (
    <Column bindToDocument label={columnLabel}>
      <Helmet>
        <title>{title} — Kronk</title>
      </Helmet>

      <div className='kronk-org' role='main' aria-label={columnLabel}>
        {/* Space title (Frame-parasite exception matches /me hub) —
            /kronk isn't a `/hub/<slug>` route so <AutoSpaceHeader>
            doesn't fire. Hand-rendered with the shared `.space-header`
            classes + `data-frame-header` attribute so the Frame's
            L11 doctor recognises this as the legitimate header. */}
        <header className='space-header kronk-org__title' data-frame-header=''>
          <h1 className='space-header__title'>{title}</h1>
          <p className='space-header__tagline'>
            <FormattedMessage {...messages.tagline} />
          </p>
        </header>

        {/* Radial dial — every nav page as a pill-labelled spoke
            around a dashed ring, centre Ж links to /kronk (about).
            Same idiom as /me and /settings hubs so Kronk's three
            "meta" hubs speak one visual language. */}
        <nav className='kronk-org__nav' aria-label='Kronk pages'>
          <div className='kronk-org__wheel'>
            <div className='kronk-org__ring' aria-hidden />
            <Link to='/kronk' className='kronk-org__center' aria-label='Kronk'>
              <span className='kronk-org__center-glyph' aria-hidden>
                Ж
              </span>
            </Link>
            {navPages.map((nav, i) => (
              <Link
                key={nav.slug}
                to={`/kronk/${nav.slug}`}
                className={classNames('kronk-org__spoke', {
                  'kronk-org__spoke--active': nav.slug === activePage,
                })}
                style={
                  {
                    '--spoke-angle': `${angleFor(i)}deg`,
                  } as React.CSSProperties
                }
              >
                <span className='kronk-org__spoke-pill'>{nav.label}</span>
              </Link>
            ))}
          </div>
        </nav>

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
