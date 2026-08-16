import { useCallback, useRef, useState } from 'react';

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
//   Page 1: the dial section (viewport-height). The KronkDial is
//   the only thing above the fold; the centre hub scrolls the
//   whole page down to Page 2 (Tal 2026-08-16 — full-page scroll,
//   not scroll-to-callout).
//
//   Page 2: the content section. Crumb + shelf header at the top;
//   below that, a piece list OR an empty state that invites the
//   user to be the first to add one (Tal 2026-08-16: purple
//   rounded square with a white plus + invite copy).
//
// HOUSES organises the placeholder taxonomy — each inner-ring
// bubble is a discipline "house" carrying its own crumb + shelf
// list. Rotating the inner ring picks a house; the outer ring
// re-populates with THAT house's shelves.

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
  emptyInvite: {
    id: 'art.empty.invite',
    defaultMessage: 'Be the first to add a new one.',
  },
  emptyBtnLabel: {
    id: 'art.empty.btn_label',
    defaultMessage: 'Add a new piece',
  },
});

// A "house" — one inner-ring bubble + its associated outer-ring
// shelves + the crumb that reads above the active shelf label.
interface ArtHouse {
  bubble: DialBubble;
  crumb: string;
  slices: DialSlice[];
}

const HOUSES: ArtHouse[] = [
  {
    bubble: { key: 'writing', label: 'Writing', Icon: ArticleIcon },
    crumb: 'WRITING · THE LIBRARY',
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
    crumb: 'PHOTOGRAPHY · THE DARKROOM',
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
    crumb: 'MUSIC · THE STUDIO',
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
    crumb: 'VOICE · THE ROUNDTABLE',
    slices: [
      { key: 'readings', label: 'Readings' },
      { key: 'voices', label: 'Voices' },
      { key: 'threads', label: 'Threads' },
      { key: 'talks', label: 'Talks' },
    ],
  },
  {
    bubble: { key: 'gallery', label: 'Gallery', Icon: PhotoLibraryIcon },
    crumb: 'VISUAL ART · THE GALLERY',
    slices: [
      { key: 'pieces', label: 'Pieces' },
      { key: 'series', label: 'Series' },
      { key: 'studies', label: 'Studies' },
      { key: 'artists', label: 'Artists' },
    ],
  },
];

const BUBBLES: DialBubble[] = HOUSES.map((h) => h.bubble);

const ArtHub: React.FC = () => {
  const intl = useIntl();
  const [innerIndex, setInnerIndex] = useState(0); // start on Writing
  const [outerIndex, setOuterIndex] = useState(0);

  // The centre hub does a full-page scroll to Page 2 (Tal
  // 2026-08-16). Content-section wrapper sits exactly one viewport
  // below the top so `scrollIntoView` on it = one full page down.
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

  const title = intl.formatMessage(messages.title);
  // HOUSES is a non-empty compile-time constant, but TS's
  // noUncheckedIndexedAccess still types the read as `T | undefined`
  // — early-guard so `currentHouse` narrows to `ArtHouse` for the
  // rest of render. Guard sits AFTER all hook calls so rules-of-
  // hooks still holds regardless of what index innerIndex carries.
  const currentHouse = HOUSES[innerIndex] ?? HOUSES[0];
  if (!currentHouse) return null;
  const outerSlices = currentHouse.slices;
  // Clamp so switching to a house with fewer slices doesn't leave
  // outerIndex pointing off the end of the new list.
  const safeOuterIndex = Math.min(outerIndex, outerSlices.length - 1);
  const activeSlice = outerSlices[safeOuterIndex] ?? outerSlices[0];

  return (
    <Stage label={title}>
      <Helmet>
        <title>{title}</title>
      </Helmet>

      <div className='art-hub'>
        {/* Page 1 — dial section. Fills the visible viewport so
            nothing from Page 2 peeks above the fold. Space title +
            tagline live above this container as Frame chrome. */}
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

        {/* Page 2 — content section. Crumb + shelf header at the
            top; below, the piece grid OR the empty state.
            Content backend hasn't shipped yet, so the empty state
            is what renders for every shelf. */}
        <section className='art-hub__content-section' ref={contentRef}>
          <header className='art-hub__content-header'>
            <p className='art-hub__crumb'>{currentHouse.crumb}</p>
            <h2 className='art-hub__shelf-title'>{activeSlice?.label}</h2>
          </header>

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
        </section>
      </div>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export -- async-components loader unwraps `.default`
export default ArtHub;
