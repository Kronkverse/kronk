import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import ArticleIcon from '@/material-icons/400-24px/article-fill.svg?react';
import ChevronLeftIcon from '@/material-icons/400-24px/chevron_left.svg?react';
import ChevronRightIcon from '@/material-icons/400-24px/chevron_right.svg?react';
import MicIcon from '@/material-icons/400-24px/mic.svg?react';
import MusicNoteIcon from '@/material-icons/400-24px/music_note-fill.svg?react';
import PhotoCameraIcon from '@/material-icons/400-24px/photo_camera.svg?react';
import PhotoLibraryIcon from '@/material-icons/400-24px/photo_library-fill.svg?react';
import type { DialBubble, DialSlice } from 'mastodon/components/kronk_dial';
import { KronkDial } from 'mastodon/components/kronk_dial';
import { useSpaceHeaderOverride } from 'mastodon/components/space_header_override';
import { Stage } from 'mastodon/components/stage';

// Art korner landing — a two-axis surface.
//
//   Page 1 (wheel): the KronkDial. Pick a discipline on the inner
//   wheel, a shelf on the outer wheel, hit the centre hub → Page 2.
//
//   Page 2 (discipline pane): a horizontal x-snap pager through
//   every discipline. Each discipline pane is itself a vertical
//   y-snap pager through its shelves, and each shelf row is a
//   horizontal x-scroll of mock piece cards.
//
// When the user hits the centre hub on the wheel, the shelves in
// their chosen discipline's pane are rotated as a LOOP so the
// picked shelf sits at the top — the remaining shelves keep
// manifest order and wrap around beneath it (Tal 2026-08-16
// "Reorder, but keep the manifest order, so the selected one
// displays first, but its a looping scroll").
//
// The Frame's SpaceHeader slot is taken over by a chevron barrel on
// Page 2 (Tal 2026-08-16 "Frame header hosts chevrons"). The barrel
// reads the current discipline label and steps through the discipline
// list in a loop; changing discipline via chevrons scrolls the
// horizontal pager and updates the inner-wheel selection so the two
// halves of the app stay coherent.
//
// Nested scroll containers — three axes total (outer y-snap,
// discipline x-snap, shelf y-snap, piece x-scroll) — each with
// `overscroll-behavior: contain` so gestures don't chain out and
// interfere with a parent scroller.

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
  emptyBtnLabel: {
    id: 'art.empty.btn_label',
    defaultMessage: 'Add a new piece',
  },
  prevDiscipline: {
    id: 'art.barrel.prev',
    defaultMessage: 'Previous discipline',
  },
  nextDiscipline: {
    id: 'art.barrel.next',
    defaultMessage: 'Next discipline',
  },
  disciplinePagerAria: {
    id: 'art.discipline_pager.aria',
    defaultMessage: 'Swipe horizontally to change discipline',
  },
  shelfPagerAria: {
    id: 'art.shelf_pager.aria',
    defaultMessage: 'Scroll vertically to change shelf in {house}',
  },
  pieceStripAria: {
    id: 'art.piece_strip.aria',
    defaultMessage: 'Scroll horizontally through {shelf}',
  },
});

// A house — one inner-ring bubble + its associated outer-ring shelves.
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

// ── Mock piece data ────────────────────────────────────────────
// Backend for Art pieces doesn't exist yet (Tal 2026-08-16 "Mock
// placeholder cards"). Each shelf gets a handful of static cards so
// the horizontal scroll + piece card design are testable on shadow.
// Titles are hand-written to feel like plausible submissions in that
// discipline; descriptions are all one-liners. Once the backend
// lands this whole block gets replaced by a fetch keyed on
// `house.key + shelf.key`.
interface Piece {
  key: string;
  title: string;
  description: string;
}

const MOCK_PIECES: Record<string, Record<string, Piece[]>> = {
  writing: {
    journals: [
      {
        key: 'j1',
        title: 'Field notes, week 12',
        description: 'A wet week and the crossings I made.',
      },
      {
        key: 'j2',
        title: 'Long afternoons',
        description: 'Watching the light do its slow work.',
      },
      {
        key: 'j3',
        title: 'Kitchen sink hours',
        description: 'On the stubborn small labours.',
      },
      {
        key: 'j4',
        title: 'Between trains',
        description: 'What a platform teaches you if you wait.',
      },
    ],
    chapters: [
      {
        key: 'c1',
        title: 'The Barrow',
        description: 'Opening chapter of the new draft.',
      },
      {
        key: 'c2',
        title: 'Salt and rope',
        description: 'Chapter two — before the storm.',
      },
      {
        key: 'c3',
        title: 'Two ferries',
        description: 'Meeting on the middle boat.',
      },
    ],
    poems: [
      {
        key: 'p1',
        title: 'A cardigan of stars',
        description: 'Winter, close.',
      },
      { key: 'p2', title: 'Half rhyme', description: 'Something almost said.' },
      {
        key: 'p3',
        title: 'The heron again',
        description: 'Late September, same bank.',
      },
      {
        key: 'p4',
        title: 'Ledger',
        description: 'The shape of a debt made small.',
      },
    ],
    essays: [
      {
        key: 'e1',
        title: 'On the shape of hollows',
        description: 'A meditation on empty forms.',
      },
      {
        key: 'e2',
        title: 'Barrows and beacons',
        description: 'What we build for others to find.',
      },
      {
        key: 'e3',
        title: 'Rooms in a book',
        description: 'The architecture of long-form.',
      },
      {
        key: 'e4',
        title: 'Signal in the corridor',
        description: 'Working notes from a long walk.',
      },
    ],
    volumes: [
      { key: 'v1', title: 'Southerlies', description: 'A first collection.' },
      { key: 'v2', title: 'Understorey', description: 'A slim second volume.' },
    ],
    authors: [
      {
        key: 'a1',
        title: 'Marise Cooper',
        description: 'Writes about long walks and short days.',
      },
      {
        key: 'a2',
        title: 'Simeon Wells',
        description: 'Fiction and its neighbours.',
      },
      {
        key: 'a3',
        title: 'Perl Nakamura',
        description: 'Essays, translations, letters.',
      },
    ],
    letters: [
      {
        key: 'l1',
        title: 'To E—, in July',
        description: 'On leaving the coast.',
      },
      {
        key: 'l2',
        title: 'Reply, unsent',
        description: 'Kept in a drawer for a year.',
      },
      {
        key: 'l3',
        title: 'From the ridge',
        description: 'A postcard with too much on it.',
      },
    ],
  },
  photography: {
    rolls: [
      {
        key: 'r1',
        title: 'Portra 400 — coast',
        description: '36 exposures along the headland.',
      },
      {
        key: 'r2',
        title: 'HP5+ — dusk shift',
        description: 'One roll, one hour.',
      },
      {
        key: 'r3',
        title: 'Ektar — the market',
        description: 'A Sunday walk-through.',
      },
    ],
    frames: [
      {
        key: 'f1',
        title: 'Waiting for the tide',
        description: 'Cold light, boots wet.',
      },
      { key: 'f2', title: 'Empty tram', description: 'Sunday, terminus.' },
      { key: 'f3', title: 'Two dogs', description: 'Never mind the leash.' },
      { key: 'f4', title: 'Stack', description: 'Bricks in the sun.' },
    ],
    series: [
      {
        key: 's1',
        title: 'The long verandah',
        description: 'Six frames across an afternoon.',
      },
      {
        key: 's2',
        title: 'Neighbours',
        description: 'A short series about doorsteps.',
      },
    ],
    photographers: [
      {
        key: 'ph1',
        title: 'Ana Mireille',
        description: 'Slow landscapes and slower shutters.',
      },
      {
        key: 'ph2',
        title: 'Rafi Choudhury',
        description: 'Portraits from the market circuit.',
      },
      {
        key: 'ph3',
        title: 'Yuki Sato',
        description: 'Wide format, quiet subjects.',
      },
    ],
    prints: [
      {
        key: 'pr1',
        title: 'Salt paper, no. 3',
        description: 'Hand-coated, one of a kind.',
      },
      {
        key: 'pr2',
        title: 'Silver gelatin, mid-tones',
        description: 'From the July session.',
      },
    ],
  },
  music: {
    tracks: [
      {
        key: 't1',
        title: 'Longing to leave',
        description: 'A first take, kept.',
      },
      { key: 't2', title: 'Slow tram', description: 'Two chords and a hum.' },
      {
        key: 't3',
        title: 'Middle child',
        description: 'For guitar and quiet room.',
      },
      {
        key: 't4',
        title: 'Kitchen jam',
        description: 'Recorded on the phone.',
      },
    ],
    albums: [
      { key: 'al1', title: 'Understorey', description: 'A first LP.' },
      {
        key: 'al2',
        title: 'Small rooms',
        description: 'Live-to-tape, one afternoon.',
      },
    ],
    sessions: [
      {
        key: 'se1',
        title: 'The Sunday sit',
        description: 'Long, unhurried, four people.',
      },
      {
        key: 'se2',
        title: 'Field recording, dusk',
        description: 'Cicadas and a distant train.',
      },
      {
        key: 'se3',
        title: 'Duo, first meeting',
        description: 'Two players finding each other.',
      },
    ],
    composers: [
      { key: 'co1', title: 'Ilya Rovin', description: 'Chamber miniatures.' },
      {
        key: 'co2',
        title: 'Mae Osei',
        description: 'Piano and voice, mostly hers.',
      },
    ],
    sets: [
      {
        key: 'st1',
        title: 'Late set, small stage',
        description: 'Six tracks, one encore.',
      },
      {
        key: 'st2',
        title: 'Warm-up for the ferry',
        description: 'Half an hour on the pier.',
      },
    ],
  },
  voice: {
    readings: [
      {
        key: 're1',
        title: 'From The Barrow, ch. 1',
        description: 'The author reads.',
      },
      {
        key: 're2',
        title: 'A cardigan of stars',
        description: 'Poem, then commentary.',
      },
      {
        key: 're3',
        title: 'On being small',
        description: 'A short essay, read aloud.',
      },
    ],
    voices: [
      {
        key: 'vo1',
        title: 'Marise Cooper',
        description: 'Warm, patient, unhurried.',
      },
      { key: 'vo2', title: 'Simeon Wells', description: 'Low, dry, careful.' },
      {
        key: 'vo3',
        title: 'Perl Nakamura',
        description: 'Bright, quick, exact.',
      },
    ],
    threads: [
      {
        key: 'th1',
        title: 'On the ferry',
        description: 'A three-part voice thread.',
      },
      {
        key: 'th2',
        title: 'Back-of-envelope',
        description: 'One idea, three passes.',
      },
    ],
    talks: [
      {
        key: 'ta1',
        title: 'The making of Understorey',
        description: 'Thirty minutes at the community hall.',
      },
      {
        key: 'ta2',
        title: 'How to keep a journal',
        description: 'A short talk, some Q&A.',
      },
    ],
  },
  gallery: {
    pieces: [
      { key: 'pi1', title: 'Fold, one', description: 'Oil on linen.' },
      { key: 'pi2', title: 'Ledger, six', description: 'Ink on paper.' },
      {
        key: 'pi3',
        title: 'A window in July',
        description: 'Watercolour, small.',
      },
      { key: 'pi4', title: 'Understorey study', description: 'Charcoal.' },
    ],
    series: [
      {
        key: 'gs1',
        title: 'The long verandah',
        description: 'Six drawings, one hour each.',
      },
      {
        key: 'gs2',
        title: 'Neighbours',
        description: 'A short suite about doorsteps.',
      },
    ],
    studies: [
      {
        key: 'st1',
        title: 'Study for The Barrow',
        description: 'Preparatory work.',
      },
      {
        key: 'st2',
        title: 'Hands, from memory',
        description: 'Practice piece.',
      },
    ],
    artists: [
      {
        key: 'ar1',
        title: 'Ana Mireille',
        description: 'Landscapes and rooms.',
      },
      {
        key: 'ar2',
        title: 'Rafi Choudhury',
        description: 'Portraits, mostly ink.',
      },
    ],
  },
};

// Rotate a shelf list so `startIndex` sits first and the rest wraps
// around beneath it — Tal 2026-08-16 asked for the picked shelf to
// display first BUT for the manifest order to survive as a loop.
// `[a, b, c, d, e]` with startIndex 3 → `[d, e, a, b, c]`.
const rotateShelves = <T,>(items: readonly T[], startIndex: number): T[] => {
  if (items.length === 0) return [];
  const clamped = ((startIndex % items.length) + items.length) % items.length;
  return items.slice(clamped).concat(items.slice(0, clamped));
};

// ── DisciplineBarrel — injected into Frame's SpaceHeader slot ──
// on Page 2 via `useSpaceHeaderOverride`. Reads the current
// discipline and offers `‹ label ›` chevrons that step through the
// discipline list in a loop.

interface DisciplineBarrelProps {
  houses: readonly ArtHouse[];
  currentIndex: number;
  onChange: (nextIndex: number) => void;
  prevLabel: string;
  nextLabel: string;
}

const DisciplineBarrel: React.FC<DisciplineBarrelProps> = ({
  houses,
  currentIndex,
  onChange,
  prevLabel,
  nextLabel,
}) => {
  const current = houses[currentIndex] ?? houses[0];
  const handlePrev = useCallback(() => {
    onChange((currentIndex - 1 + houses.length) % houses.length);
  }, [currentIndex, houses.length, onChange]);
  const handleNext = useCallback(() => {
    onChange((currentIndex + 1) % houses.length);
  }, [currentIndex, houses.length, onChange]);
  if (!current) return null;
  return (
    <div className='art-discipline-barrel' data-frame-header=''>
      <button
        type='button'
        className='art-discipline-barrel__chevron'
        onClick={handlePrev}
        aria-label={prevLabel}
      >
        <ChevronLeftIcon />
      </button>
      <h1 className='art-discipline-barrel__label'>{current.bubble.label}</h1>
      <button
        type='button'
        className='art-discipline-barrel__chevron'
        onClick={handleNext}
        aria-label={nextLabel}
      >
        <ChevronRightIcon />
      </button>
    </div>
  );
};

// ── PieceCard — mock placeholder for a single Art submission. ──
// Real cards will come from the API once the backend lands; this
// keeps the horizontal-strip geometry testable in the meantime.

interface PieceCardProps {
  piece: Piece;
}

const PieceCard: React.FC<PieceCardProps> = ({ piece }) => (
  <article className='art-piece-card'>
    <h4 className='art-piece-card__title'>{piece.title}</h4>
    <p className='art-piece-card__desc'>{piece.description}</p>
  </article>
);

// ── ShelfRow — one shelf's worth of pieces, laid out as a
// horizontal scroll strip with the shelf name and (until a piece
// exists) an inline "add a piece" call to the composer.

interface ShelfRowProps {
  shelf: DialSlice;
  pieces: readonly Piece[];
  ariaLabel: string;
  addPieceLabel: string;
}

const ShelfRow: React.FC<ShelfRowProps> = ({
  shelf,
  pieces,
  ariaLabel,
  addPieceLabel,
}) => (
  <section className='art-shelf-row'>
    <header className='art-shelf-row__head'>
      <h3 className='art-shelf-row__label'>{shelf.label}</h3>
    </header>
    <div className='art-shelf-row__strip' role='group' aria-label={ariaLabel}>
      {pieces.map((piece) => (
        <PieceCard key={piece.key} piece={piece} />
      ))}
      <a
        href='/hub/art/composer'
        className='art-shelf-row__add'
        aria-label={addPieceLabel}
      >
        <AddIcon />
      </a>
    </div>
  </section>
);

// ── DisciplinePane — one full-viewport pane in the discipline
// horizontal pager. Contains the y-snap vertical stack of shelf-rows,
// rotated so `startShelfIndex` sits at the top (loop order).

interface DisciplinePaneProps {
  house: ArtHouse;
  startShelfIndex: number;
  pieces: Record<string, Piece[] | undefined>;
  shelfPagerAria: string;
  formatPieceStripAria: (shelfLabel: string) => string;
  addPieceLabel: string;
}

const DisciplinePane: React.FC<DisciplinePaneProps> = ({
  house,
  startShelfIndex,
  pieces,
  shelfPagerAria,
  formatPieceStripAria,
  addPieceLabel,
}) => {
  const ordered = useMemo(
    () => rotateShelves(house.slices, startShelfIndex),
    [house.slices, startShelfIndex],
  );
  return (
    <article className='art-discipline-pane' aria-label={house.bubble.label}>
      <div className='art-discipline-pane__shelves' aria-label={shelfPagerAria}>
        {ordered.map((shelf) => (
          <ShelfRow
            key={shelf.key}
            shelf={shelf}
            pieces={pieces[shelf.key] ?? []}
            ariaLabel={formatPieceStripAria(shelf.label)}
            addPieceLabel={addPieceLabel}
          />
        ))}
      </div>
    </article>
  );
};

const ArtHub: React.FC = () => {
  const intl = useIntl();
  const [innerIndex, setInnerIndex] = useState(0); // discipline
  const [outerIndex, setOuterIndex] = useState(0); // shelf within discipline

  // ── Refs for the three nested scroll containers ────────────────
  //   artHubRef        — outer y-snap (Page 1 wheel, Page 2 pane)
  //   contentPageRef   — the Page 2 section; scrollIntoView target
  //                      from the wheel's centre hub.
  //   disciplineScrollerRef — the x-snap between discipline panes.
  const artHubRef = useRef<HTMLDivElement | null>(null);
  const contentPageRef = useRef<HTMLElement | null>(null);
  const disciplineScrollerRef = useRef<HTMLDivElement | null>(null);

  const isProgrammaticXScrollRef = useRef(false);
  const programmaticXScrollTimeoutRef = useRef<number | null>(null);

  // Centre hub → smooth scroll to Page 2. The nearest scroll
  // ancestor is .art-hub (own overflow-y auto), so this snaps.
  const handleCenterClick = useCallback(() => {
    contentPageRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, []);

  // Wheel picks a new discipline (inner ring) → reset the shelf
  // pick to 0 for THAT discipline, and slide the horizontal pager
  // to the matching pane (so Page 2 is coherent when the user
  // scrolls down).
  const handleInnerChange = useCallback((next: number) => {
    setInnerIndex(next);
    setOuterIndex(0);
  }, []);

  // Discipline change from the barrel chevrons → same as inner-ring
  // change but with an explicit index; also reset shelf.
  const handleDisciplineChange = useCallback((next: number) => {
    setInnerIndex(next);
    setOuterIndex(0);
  }, []);

  // ── Sync innerIndex → discipline x-scroll ─────────────────────
  // When innerIndex changes (from wheel spin / spoke click / barrel
  // chevron), scroll the horizontal pager to that pane. Guard the
  // handler against echo via `isProgrammaticXScrollRef`.
  useEffect(() => {
    const el = disciplineScrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    const target = innerIndex * el.clientWidth;
    if (Math.abs(el.scrollLeft - target) < 4) return;
    isProgrammaticXScrollRef.current = true;
    el.scrollTo({ left: target, behavior: 'smooth' });
    if (programmaticXScrollTimeoutRef.current !== null) {
      window.clearTimeout(programmaticXScrollTimeoutRef.current);
    }
    programmaticXScrollTimeoutRef.current = window.setTimeout(() => {
      isProgrammaticXScrollRef.current = false;
      programmaticXScrollTimeoutRef.current = null;
    }, 500);
  }, [innerIndex]);

  // ── Sync discipline x-scroll → innerIndex ─────────────────────
  // rAF-throttled scroll listener reads the settled pane index and
  // updates state so the wheel stays coherent.
  useEffect(() => {
    const el = disciplineScrollerRef.current;
    if (!el) return;
    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        if (isProgrammaticXScrollRef.current) return;
        if (!el.clientWidth) return;
        const idx = Math.round(el.scrollLeft / el.clientWidth);
        if (idx >= 0 && idx < HOUSES.length) {
          setInnerIndex((prev) => (prev === idx ? prev : idx));
        }
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  const currentHouse = HOUSES[innerIndex] ?? HOUSES[0];
  const outerSlices = currentHouse?.slices ?? [];
  const safeOuterIndex = Math.min(
    outerIndex,
    Math.max(outerSlices.length - 1, 0),
  );

  // ── Frame header override — barrel with chevrons ──────────────
  // Memoise the injected node so the effect inside
  // `useSpaceHeaderOverride` doesn't re-fire every render.
  const prevLabel = intl.formatMessage(messages.prevDiscipline);
  const nextLabel = intl.formatMessage(messages.nextDiscipline);
  const barrelNode = useMemo(
    () => (
      <DisciplineBarrel
        houses={HOUSES}
        currentIndex={innerIndex}
        onChange={handleDisciplineChange}
        prevLabel={prevLabel}
        nextLabel={nextLabel}
      />
    ),
    [innerIndex, handleDisciplineChange, prevLabel, nextLabel],
  );
  useSpaceHeaderOverride(barrelNode);

  const title = intl.formatMessage(messages.title);
  const shelfPagerAria = useMemo(
    () =>
      intl.formatMessage(messages.shelfPagerAria, {
        house: currentHouse?.bubble.label ?? '',
      }),
    [intl, currentHouse?.bubble.label],
  );
  const formatPieceStripAria = useCallback(
    (shelfLabel: string) =>
      intl.formatMessage(messages.pieceStripAria, { shelf: shelfLabel }),
    [intl],
  );
  const addPieceLabel = intl.formatMessage(messages.emptyBtnLabel);

  if (!currentHouse) return null;

  return (
    <Stage label={title}>
      <Helmet>
        <title>{title}</title>
      </Helmet>

      <div className='art-hub' ref={artHubRef}>
        {/* Page 1 — wheel. Fills the visible Stage-below-header. */}
        <section className='art-hub__wheel-page'>
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

        {/* Page 2 — discipline horizontal pager. Each pane holds the
            y-snap of shelf-rows for that discipline. */}
        <section
          className='art-hub__content-page'
          ref={contentPageRef}
          aria-label={intl.formatMessage(messages.disciplinePagerAria)}
        >
          <div
            className='art-hub__discipline-scroller'
            ref={disciplineScrollerRef}
          >
            {HOUSES.map((house, i) => (
              <DisciplinePane
                key={house.bubble.key}
                house={house}
                // Only the discipline the user is on carries their
                // outer-wheel pick; the others open at manifest top
                // so nav feels stable.
                startShelfIndex={i === innerIndex ? safeOuterIndex : 0}
                pieces={MOCK_PIECES[house.bubble.key] ?? {}}
                shelfPagerAria={shelfPagerAria}
                formatPieceStripAria={formatPieceStripAria}
                addPieceLabel={addPieceLabel}
              />
            ))}
          </div>
        </section>
      </div>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export -- async-components loader unwraps `.default`
export default ArtHub;
