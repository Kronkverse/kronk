import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import ArticleIcon from '@/material-icons/400-24px/article-fill.svg?react';
import MicIcon from '@/material-icons/400-24px/mic.svg?react';
import MusicNoteIcon from '@/material-icons/400-24px/music_note-fill.svg?react';
import PhotoCameraIcon from '@/material-icons/400-24px/photo_camera.svg?react';
import PhotoLibraryIcon from '@/material-icons/400-24px/photo_library-fill.svg?react';
import type { DialBubble, DialSlice } from 'mastodon/components/kronk_dial';
import { KronkDial } from 'mastodon/components/kronk_dial';
import { Stage } from 'mastodon/components/stage';

// Art korner landing — two-page-height scaffold.
//
//   Page 1: the dial section. Only the KronkDial sits above the fold;
//   the centre hub scrolls the whole page down to Page 2 (Tal
//   2026-08-16 — full-page scroll, not scroll-to-callout).
//
//   Page 2: the content section. Big house title (the inner wheel's
//   current selection — "Writing", "Photography", …) at the top,
//   then a horizontal swipe carousel that pages through THAT house's
//   shelves (Tal 2026-08-16). Each shelf is a full-width panel that
//   scroll-snaps into place; swipe left/right on touch, trackpad-
//   scroll horizontally, or spin the dial's outer ring — they stay
//   in sync. Until a piece backend ships, every shelf shows the same
//   empty state (Tal 2026-08-16: purple rounded square + invite).
//
// HOUSES organises the placeholder taxonomy — each inner-ring bubble
// is a discipline "house" carrying its own shelf list. Rotating the
// inner ring picks a house; the outer ring + the Page 2 carousel
// re-populate with THAT house's shelves.

const messages = defineMessages({
  title: { id: 'art.title', defaultMessage: 'Art' },
  outerAria: {
    id: 'art.dial.outer_aria',
    defaultMessage: 'Choose a shelf within this house',
  },
  innerAria: {
    id: 'art.dial.inner_aria',
    defaultMessage: 'Choose a house',
  },
  centerAction: {
    id: 'art.dial.center_action',
    defaultMessage: 'Scroll to the content below',
  },
  carouselAria: {
    id: 'art.carousel.aria',
    defaultMessage: 'Swipe through the shelves in {house}',
  },
  emptyInvite: {
    id: 'art.empty.invite',
    defaultMessage: 'Be the first to add a new one.',
  },
  emptyBtnLabel: {
    id: 'art.empty.btn_label',
    defaultMessage: 'Add a new piece',
  },
});

// A "house" — one inner-ring bubble + its associated outer-ring shelves.
interface ArtHouse {
  bubble: DialBubble;
  slices: DialSlice[];
}

const HOUSES: ArtHouse[] = [
  {
    bubble: { key: 'writing', label: 'Writing', Icon: ArticleIcon },
    slices: [
      { key: 'journals', label: 'Journals' },
      { key: 'chapters', label: 'Chapters' },
      { key: 'poems', label: 'Poems' },
      { key: 'essays', label: 'Essays' },
      { key: 'volumes', label: 'Volumes' },
      { key: 'authors', label: 'Authors' },
      { key: 'letters', label: 'Letters' },
    ],
  },
  {
    bubble: { key: 'photography', label: 'Photography', Icon: PhotoCameraIcon },
    slices: [
      { key: 'rolls', label: 'Rolls' },
      { key: 'frames', label: 'Frames' },
      { key: 'series', label: 'Series' },
      { key: 'photographers', label: 'Photographers' },
      { key: 'prints', label: 'Prints' },
    ],
  },
  {
    bubble: { key: 'music', label: 'Music', Icon: MusicNoteIcon },
    slices: [
      { key: 'tracks', label: 'Tracks' },
      { key: 'albums', label: 'Albums' },
      { key: 'sessions', label: 'Sessions' },
      { key: 'composers', label: 'Composers' },
      { key: 'sets', label: 'Sets' },
    ],
  },
  {
    bubble: { key: 'voice', label: 'Voice', Icon: MicIcon },
    slices: [
      { key: 'readings', label: 'Readings' },
      { key: 'voices', label: 'Voices' },
      { key: 'threads', label: 'Threads' },
      { key: 'talks', label: 'Talks' },
    ],
  },
  {
    bubble: { key: 'gallery', label: 'Gallery', Icon: PhotoLibraryIcon },
    slices: [
      { key: 'pieces', label: 'Pieces' },
      { key: 'series', label: 'Series' },
      { key: 'studies', label: 'Studies' },
      { key: 'artists', label: 'Artists' },
    ],
  },
];

const BUBBLES: DialBubble[] = HOUSES.map((h) => h.bubble);

// Small dot button below the carousel — one per shelf. Own component
// so the click handler doesn't re-allocate per render (react/jsx-no-
// bind); the pip receives its target index and the change callback.
interface ShelfPipProps {
  index: number;
  label: string;
  active: boolean;
  onSelect: (index: number) => void;
}

const ShelfPip: React.FC<ShelfPipProps> = ({
  index,
  label,
  active,
  onSelect,
}) => {
  const handleClick = useCallback(() => {
    onSelect(index);
  }, [index, onSelect]);
  return (
    <button
      type='button'
      className='art-hub__shelf-pip'
      aria-current={active ? 'true' : undefined}
      aria-label={label}
      onClick={handleClick}
    />
  );
};

const ArtHub: React.FC = () => {
  const intl = useIntl();
  const [innerIndex, setInnerIndex] = useState(0); // start on Writing
  const [outerIndex, setOuterIndex] = useState(0);

  // The centre hub does a full-page scroll to Page 2 (Tal 2026-08-16).
  // Content-section wrapper sits one viewport below the top so
  // `scrollIntoView` on it = one full page down.
  const contentRef = useRef<HTMLElement | null>(null);
  const handleCenterClick = useCallback(() => {
    contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // When the inner ring picks a new house, reset the outer selection
  // to that house's first slice — otherwise we'd carry over an index
  // that means a different shelf (or none at all) in the new set.
  const handleInnerChange = useCallback((next: number) => {
    setInnerIndex(next);
    setOuterIndex(0);
  }, []);

  // ── Page 2 carousel <-> outerIndex sync ─────────────────────────
  // Two directions to keep coherent:
  //   * external change (wheel spin, spoke click) → programmatic
  //     horizontal scroll into the matching panel;
  //   * user swipe / scroll of the carousel → detect the settled
  //     panel via scroll position and update outerIndex.
  // `isProgrammaticScrollRef` prevents an echo where our own
  // programmatic scroll then re-fires the scroll handler and
  // clobbers state we just set.
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const isProgrammaticScrollRef = useRef(false);
  const programmaticScrollTimeoutRef = useRef<number | null>(null);

  const currentHouse = HOUSES[innerIndex] ?? HOUSES[0];
  const outerSlices = currentHouse?.slices ?? [];
  const safeOuterIndex = Math.min(
    outerIndex,
    Math.max(outerSlices.length - 1, 0),
  );

  useEffect(() => {
    const el = carouselRef.current;
    if (!el || el.clientWidth === 0) return;
    const target = safeOuterIndex * el.clientWidth;
    if (Math.abs(el.scrollLeft - target) < 4) return;
    isProgrammaticScrollRef.current = true;
    el.scrollTo({ left: target, behavior: 'smooth' });
    if (programmaticScrollTimeoutRef.current !== null) {
      window.clearTimeout(programmaticScrollTimeoutRef.current);
    }
    programmaticScrollTimeoutRef.current = window.setTimeout(() => {
      isProgrammaticScrollRef.current = false;
      programmaticScrollTimeoutRef.current = null;
    }, 500);
  }, [safeOuterIndex]);

  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        if (isProgrammaticScrollRef.current) return;
        if (!el.clientWidth) return;
        const idx = Math.round(el.scrollLeft / el.clientWidth);
        if (idx >= 0 && idx < outerSlices.length) {
          setOuterIndex((prev) => (prev === idx ? prev : idx));
        }
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, [outerSlices.length]);

  const title = intl.formatMessage(messages.title);
  // HOUSES is a non-empty compile-time constant, but TS's
  // noUncheckedIndexedAccess still types the read as `T | undefined`
  // — early-guard so `currentHouse` narrows to `ArtHouse` for the
  // rest of render. Guard sits AFTER all hook calls so rules-of-hooks
  // still holds regardless of what index innerIndex carries.
  if (!currentHouse) return null;
  const houseLabel = currentHouse.bubble.label;

  return (
    <Stage label={title}>
      <Helmet>
        <title>{title}</title>
      </Helmet>

      <div className='art-hub'>
        {/* Page 1 — dial section. Fills the visible viewport below
            the SpaceHeaderRow (see _art_hub.scss). */}
        <section className='art-hub__dial-section'>
          <KronkDial
            outer={outerSlices}
            outerIndex={safeOuterIndex}
            onOuterChange={setOuterIndex}
            inner={BUBBLES}
            innerIndex={innerIndex}
            onInnerChange={handleInnerChange}
            onCenterClick={handleCenterClick}
            centerActionLabel={intl.formatMessage(messages.centerAction)}
            outerAriaLabel={intl.formatMessage(messages.outerAria)}
            innerAriaLabel={intl.formatMessage(messages.innerAria)}
          />
        </section>

        {/* Page 2 — big house title, then a horizontal swipe
            carousel of shelves. Each shelf shows an empty-state
            invite until a piece backend ships. */}
        <section className='art-hub__content-section' ref={contentRef}>
          <h2 className='art-hub__house-title'>{houseLabel}</h2>

          <div
            // Remount when the house changes so the carousel's
            // scroll position resets to 0 without a smooth-scroll
            // race against the new panel widths.
            key={currentHouse.bubble.key}
            ref={carouselRef}
            className='art-hub__shelf-carousel'
            role='group'
            aria-label={intl.formatMessage(messages.carouselAria, {
              house: houseLabel,
            })}
          >
            {outerSlices.map((slice, i) => (
              <article
                key={slice.key}
                className='art-hub__shelf'
                aria-current={i === safeOuterIndex ? 'true' : undefined}
              >
                <h3 className='art-hub__shelf-title'>{slice.label}</h3>
                <div className='art-hub__empty'>
                  <Link
                    to='/hub/art/composer'
                    className='art-hub__empty-btn'
                    aria-label={intl.formatMessage(messages.emptyBtnLabel)}
                  >
                    <AddIcon />
                  </Link>
                  <p className='art-hub__empty-text'>
                    {intl.formatMessage(messages.emptyInvite)}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <ol
            className='art-hub__shelf-pips'
            aria-label={intl.formatMessage(messages.outerAria)}
          >
            {outerSlices.map((slice, i) => (
              <li key={slice.key}>
                <ShelfPip
                  index={i}
                  label={slice.label}
                  active={i === safeOuterIndex}
                  onSelect={setOuterIndex}
                />
              </li>
            ))}
          </ol>
        </section>
      </div>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export -- async-components loader unwraps `.default`
export default ArtHub;
