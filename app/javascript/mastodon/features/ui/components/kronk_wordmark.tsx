import { useCallback, useRef } from 'react';

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
// Default click on any glyph (or the wordmark as a whole via keyboard
// Enter) navigates to `/kronk` — the Kronk org space (spec §O),
// Rails-served, so a plain <a> full-navigates.
//
// **Ѻ is the easter-egg glyph.** Three clicks on Ѻ within 400ms of
// each other suppress the /kronk navigation and route to
// `EASTER_EGG_HREF` instead. A single or double click on Ѻ still
// reaches /kronk after the detection window elapses (~400ms) — barely
// perceptible but long enough for a triple-click to register.
// Destination TBD; the mechanism is what matters. Middle-click and
// right-click on Ѻ behave as normal anchor interactions (open in new
// tab, context menu) — the intercept only fires on primary-button
// click, matching how the browser distinguishes those events.

const GLYPHS = ['Ж', 'Я', 'Ѻ', 'Ɲ', '₭'] as const;
const O_INDEX = 2;
const TRIPLE_CLICK_WINDOW_MS = 400;
const KRONK_HREF = '/kronk';
// TBD — Tal will pick where Ѻ³ leads. For now, land on /kronk with a
// query param so the intent is legible in server logs / analytics.
const EASTER_EGG_HREF = '/kronk?ephemera=1';

type WordmarkSize = 'chrome' | 'hero' | 'inline';

interface KronkWordmarkProps {
  size?: WordmarkSize;
}

export const KronkWordmark: React.FC<KronkWordmarkProps> = ({
  size = 'chrome',
}) => {
  const clickCount = useRef(0);
  const timerRef = useRef<number | null>(null);

  const handleOClick = useCallback((event: React.MouseEvent) => {
    // Only intercept primary-button clicks. Middle-click / cmd-click
    // never fires onClick with button=0, but be explicit.
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    clickCount.current += 1;

    if (clickCount.current >= 3) {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      clickCount.current = 0;
      window.location.href = EASTER_EGG_HREF;
      return;
    }

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      clickCount.current = 0;
      timerRef.current = null;
      window.location.href = KRONK_HREF;
    }, TRIPLE_CLICK_WINDOW_MS);
  }, []);

  return (
    <a
      href={KRONK_HREF}
      className={`kronk-wordmark kronk-wordmark--${size}`}
      aria-label='Kronk'
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
    </a>
  );
};
