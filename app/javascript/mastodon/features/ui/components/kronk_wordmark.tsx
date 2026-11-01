import { useCallback, useEffect, useRef } from 'react';

import { Link, useHistory } from 'react-router-dom';

// Kronk wordmark, top-left in the app chrome. Five Cyrillic marks
// (Ж Я Ѻ Ɲ ₭, font in _fonts.scss) rendered as INDIVIDUAL character
// spans — not one word/logo — so per-character routing can hang off
// individual glyphs.
//
// Sibling of the Rails partial at `app/views/shared/_kronk_wordmark.html.haml`
// — both emit the same 5-span structure with a size modifier. CSS
// lives in `styles/kronk/_wordmark.scss` (base `.kronk-wordmark` +
// `.kronk-wordmark--{chrome,hero,inline}` variants).
//
// Clicking any glyph goes Home (2.2.0, Tal 2026-11-01: Home is the
// screen in the middle, and the pillars are the four sections). It went
// to `/kronk`, the Kronk org space, which Join now carries as a tile.
//
// **It used to be a full page load.** `/kronk` was Rails-served until
// #1882 (2026-09-14) made it a real SPA route, and this component kept
// the plain `<a href>` + `window.location.href` that was the only way
// to reach it before. The result was the one destination in the whole
// chrome that tore the app down and booted it again from zero — new
// bundle parse, new Redux store, feed state and scroll position gone —
// which is precisely why the org space felt like a different website
// (Tal, 2026-09-15). `<Link>` renders the same anchor with the same
// href, so middle-click, cmd-click and "open in new tab" are
// unaffected; only the same-tab click changes, from a reload to a
// route change.
//
// **Ѻ is the easter-egg glyph.** Three primary-button clicks on Ѻ
// within 400ms of each other route to `EASTER_EGG_HREF` instead.
//
// The first two clicks are NOT suppressed: they navigate to /kronk
// immediately like any other glyph, and clicks two and three simply
// land on the wordmark again — it lives in the frame's top band, which
// stays mounted across route changes, so the counter survives the
// navigation. Before, every click on Ѻ sat on a 400ms timer waiting to
// find out whether more were coming, which taxed everyone to keep a
// gag almost nobody triggers.
//
// Note the destination is still TBD. `?ephemera=1` was chosen so the
// intent would show up in server logs — which no longer happens now
// that this is client-side navigation. When the real destination is
// picked, it goes here.

const GLYPHS = ['Ж', 'Я', 'Ѻ', 'Ɲ', '₭'] as const;
const O_INDEX = 2;
const TRIPLE_CLICK_WINDOW_MS = 400;
const HOME_HREF = '/home';
const EASTER_EGG_LOCATION = { pathname: '/kronk', search: '?ephemera=1' };

type WordmarkSize = 'chrome' | 'hero' | 'inline';

interface KronkWordmarkProps {
  size?: WordmarkSize;
}

export const KronkWordmark: React.FC<KronkWordmarkProps> = ({
  size = 'chrome',
}) => {
  const history = useHistory();
  const clickCount = useRef(0);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const handleOClick = useCallback(
    (event: React.MouseEvent) => {
      // Only count primary-button clicks. Middle-click and cmd-click
      // stay ordinary anchor interactions.
      if (event.button !== 0 || event.metaKey || event.ctrlKey) return;

      clickCount.current += 1;

      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        clickCount.current = 0;
        timerRef.current = null;
      }, TRIPLE_CLICK_WINDOW_MS);

      if (clickCount.current < 3) return;

      window.clearTimeout(timerRef.current);
      timerRef.current = null;
      clickCount.current = 0;

      // Third click wins: stop the Link taking us Home.
      event.preventDefault();
      event.stopPropagation();
      // A location object, not a path string with a query — the router
      // wrapper folds `push('/path?x')` into the pathname.
      history.push(EASTER_EGG_LOCATION);
    },
    [history],
  );

  return (
    <Link
      to={HOME_HREF}
      className={`kronk-wordmark kronk-wordmark--${size}`}
      aria-label='Kronk'
      data-walkthrough-anchor={size === 'chrome' ? 'nav-home' : undefined}
    >
      {GLYPHS.map((glyph, index) => (
        <span
          key={glyph}
          className='kronk-wordmark__char'
          aria-hidden='true'
          onClick={index === O_INDEX ? handleOClick : undefined}
        >
          {glyph}
        </span>
      ))}
    </Link>
  );
};
