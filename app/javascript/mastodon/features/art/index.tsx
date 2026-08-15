import { useCallback, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import ArticleIcon from '@/material-icons/400-24px/article-fill.svg?react';
import MicIcon from '@/material-icons/400-24px/mic.svg?react';
import MusicNoteIcon from '@/material-icons/400-24px/music_note-fill.svg?react';
import PhotoCameraIcon from '@/material-icons/400-24px/photo_camera.svg?react';
import PhotoLibraryIcon from '@/material-icons/400-24px/photo_library-fill.svg?react';
import type { DialBubble, DialSlice } from 'mastodon/components/kronk_dial';
import { KronkDial } from 'mastodon/components/kronk_dial';
import { Stage } from 'mastodon/components/stage';

// Art korner landing — scaffold. Renders the concentric volvelle
// (kronk_dial) with placeholder data organised as MEDIA: each inner
// ring bubble is a discipline "house" (Writing, Photography, Music,
// Voice, Gallery) and carries its own set of outer-ring slices +
// its own crumb ("WRITING · THE LIBRARY"). Rotating the inner ring
// picks a house; the outer ring re-populates with THAT house's
// shelves. The callout below reads the two coordinates together.
//
// Tal 2026-08-15: "when I switch to a different inner ring, the
// outer ring stays the same? clearly it should change." The two
// rings weren't independent axes — the outer's content depends on
// the current inner slice.
//
// No content plumbing yet — drags rotate the wheel and update the
// "shown" callout below, but there's no piece grid underneath. That
// lands with the composer + a real content backend.

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

  // The centre hub is wired to scroll the viewer down to the content
  // area below the dial (Tal 2026-08-15). Once a real piece list
  // lives here the ref moves to it; for now it lands on the callout.
  const contentRef = useRef<HTMLDivElement | null>(null);
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
        {/* Space title + tagline are provided by the Frame-level
            <AutoSpaceHeader> (fired by <Stage>) — reading them from
            config/korners/art.yaml. */}

        <div className='art-hub__dial'>
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
        </div>

        {/* Selection callout — reads the two coordinates together.
            Crumb comes from the current house; title comes from the
            current shelf within it. */}
        <div className='art-hub__callout' ref={contentRef}>
          <p className='art-hub__callout-crumb'>{currentHouse.crumb}</p>
          <h2 className='art-hub__callout-title'>{activeSlice?.label}</h2>
        </div>
      </div>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export -- async-components loader unwraps `.default`
export default ArtHub;
