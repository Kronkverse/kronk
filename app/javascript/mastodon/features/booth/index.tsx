import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';
import type { MessageDescriptor } from 'react-intl';

import classNames from 'classnames';
import { Helmet } from 'react-helmet';
import { Link, useHistory, useLocation } from 'react-router-dom';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import SearchIcon from '@/material-icons/400-24px/search.svg?react';
import { showAlert } from 'mastodon/actions/alerts';
import { EmptyState } from 'mastodon/components/empty_state';
import { Icon } from 'mastodon/components/icon';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerPill } from 'mastodon/components/korner_pill';
import { KornerShell } from 'mastodon/components/korner_shell';
import { LoadingState } from 'mastodon/components/loading_state';
import { SpaceGrid } from 'mastodon/components/space_grid';
import { useIdentity } from 'mastodon/identity_context';
import { useAppDispatch } from 'mastodon/store';

import {
  BoothArtistChip,
  artistInitial,
  artistStatLabel,
} from './components/booth_artist_chip';
import type { BoothArtist } from './components/booth_artist_chip';
import { BoothComposer } from './components/booth_composer';
import { BoothDock } from './components/booth_dock';
import { BoothGridCard } from './components/booth_grid_card';
import { EditForm } from './components/edit_form';
import { LiveComposer } from './components/live_composer';
import type { LiveCreated } from './components/live_composer';
import { LiveCard, LiveNowStrip, LiveView } from './components/live_view';
import { ShareForm } from './components/share_form';
import { KINDS, kindMessage } from './kinds';
import type { BoothCredit, BoothKind, BoothSet } from './types';
import { useBoothLives } from './use_booth_lives';
import { useBoothSets } from './use_booth_sets';
import type { BoothSort } from './use_booth_sets';

// The Booth — Musik (every set, searchable and sortable), Live (sets
// played live on Huddle's Jitsi server, now and coming up), My sets (your
// own sets, live sets and saved sets) and Artists (the people behind
// them). Both are views of the manifest
// (`config/korners/booth.yaml`), routed by `<KornerShell>` from the URL
// segment after `/hub/booth`; the Frame draws the title rotator.
//
// Uploading and going live are the Ж menu's "Upload or go live"
// (`/hub/booth/composer`, `/composer/live` for Go live); the
// how-it-works strip and the empty state point at it too, because a
// musician arriving for the first time shouldn't have to find the Ж
// before they know what the Booth is for.

const messages = defineMessages({
  heading: { id: 'booth.title', defaultMessage: 'The Booth' },
  loading: { id: 'booth.loading', defaultMessage: 'Loading sets…' },
  empty: { id: 'booth.empty', defaultMessage: 'No sets yet' },
  emptyBody: {
    id: 'booth.empty_body',
    defaultMessage: 'Upload the first one: a DJ set, a mix, a live recording.',
  },
  noMatch: {
    id: 'booth.no_match',
    defaultMessage: 'Nothing matches that',
  },
  noMatchBody: {
    id: 'booth.no_match_body',
    defaultMessage: 'Try another word or genre, or clear the search.',
  },
  upload: { id: 'booth.upload_cta', defaultMessage: 'Upload a set' },
  search: {
    id: 'booth.search',
    defaultMessage: 'Search sets, artists or genres',
  },
  clearSearch: { id: 'booth.search_clear', defaultMessage: 'Clear search' },
  allGenres: { id: 'booth.genre_all', defaultMessage: 'All genres' },
  allKinds: { id: 'booth.kind_all', defaultMessage: 'All kinds' },
  kindLabel: { id: 'booth.filter.kind', defaultMessage: 'Kind' },
  sortChosen: {
    id: 'booth.filter.sort_chosen',
    defaultMessage: 'Sort: {sort}',
  },
  kindChosen: {
    id: 'booth.filter.kind_chosen',
    defaultMessage: 'Kind: {kind}',
  },
  genreLabel: { id: 'booth.filter.genre', defaultMessage: 'Genre' },
  genreChosen: {
    id: 'booth.filter.genre_chosen',
    defaultMessage: 'Genre: {genre}',
  },
  kinds: { id: 'booth.kinds', defaultMessage: 'Kinds' },
  sortLabel: { id: 'booth.sort', defaultMessage: 'Sort' },
  firstListens: { id: 'booth.first_listens', defaultMessage: 'First listens' },
  firstListensBody: {
    id: 'booth.first_listens_body',
    defaultMessage:
      'New this month and barely heard yet. Be one of the first to listen, and leave a shoutout.',
  },
  seeAll: { id: 'booth.first_listens_all', defaultMessage: 'See all' },
  everything: {
    id: 'booth.first_listens_back',
    defaultMessage: 'Back to all sets',
  },
  sortNewest: { id: 'booth.sort.newest', defaultMessage: 'Newest' },
  sortFewest: { id: 'booth.sort.fewest', defaultMessage: 'Fewest listens' },
  sortLongest: { id: 'booth.sort.longest', defaultMessage: 'Longest' },
  genres: { id: 'booth.genres', defaultMessage: 'Genres' },
  loadMore: { id: 'booth.load_more', defaultMessage: 'Load more sets' },
  artistsEmpty: {
    id: 'booth.artists_empty',
    defaultMessage: 'No artists yet — publish a set to appear here.',
  },
  shared: { id: 'booth.shared', defaultMessage: 'Shared to your feed' },
  goLive: { id: 'booth.live.go_live', defaultMessage: 'Go live' },
  mineSets: { id: 'booth.mine.sets', defaultMessage: 'Sets' },
  minePlays: { id: 'booth.mine.plays', defaultMessage: 'Plays' },
  mineLives: { id: 'booth.mine.lives', defaultMessage: 'Live sets coming' },
  mineSaved: { id: 'booth.mine.saved', defaultMessage: 'Saved' },
  mineSetsHeading: {
    id: 'booth.mine.sets_heading',
    defaultMessage: 'Your sets',
  },
  mineSetsEmpty: {
    id: 'booth.mine.sets_empty',
    defaultMessage: 'You haven’t uploaded a set yet',
  },
  mineLivesHeading: {
    id: 'booth.mine.lives_heading',
    defaultMessage: 'Your live sets',
  },
  mineLivesEmpty: {
    id: 'booth.mine.lives_empty',
    defaultMessage: 'No live sets planned',
  },
  mineSavedHeading: { id: 'booth.mine.saved_heading', defaultMessage: 'Saved' },
  mineSavedEmpty: {
    id: 'booth.mine.saved_empty',
    defaultMessage: 'Nothing saved yet',
  },
  mineSavedEmptyBody: {
    id: 'booth.mine.saved_empty_body',
    defaultMessage:
      'Tap ♡ on any set to keep it here. Only you see what you save.',
  },
  introTitle: {
    id: 'booth.intro.title',
    defaultMessage: 'How the Booth works',
  },
  introUpload: {
    id: 'booth.intro.upload',
    defaultMessage:
      'Upload a set from the Ж menu (Upload or go live): the audio file, a title and a cover. That’s all it needs.',
  },
  introShare: {
    id: 'booth.intro.share',
    defaultMessage:
      'Every member can find it here. Post it to your feed as you upload, or later from the set’s page, so your people hear it.',
  },
  introCredit: {
    id: 'booth.intro.credit',
    defaultMessage:
      'Credit who you played with. Once they confirm, the set shows under their name in Artists too.',
  },
  introLive: {
    id: 'booth.intro.live',
    defaultMessage:
      'Play live: choose Go live in the same menu, now or at a time you set, and members listen in from Live.',
  },
  introDismiss: { id: 'booth.intro.dismiss', defaultMessage: 'Got it' },
});

const INTRO_KEY = 'kronk.booth.intro_dismissed';
const GENRE_CHIPS = 8;
type FilterKey = 'sort' | 'kind' | 'genre';

const SORTS: readonly BoothSort[] = ['newest', 'fewest', 'longest'];
const SORT_MESSAGES: Record<BoothSort, MessageDescriptor> = {
  newest: messages.sortNewest,
  fewest: messages.sortFewest,
  longest: messages.sortLongest,
};

// How many First listens show up front before "See all".
const FIRST_SHELF = 4;

function readIntroDismissed(): boolean {
  try {
    return window.localStorage.getItem(INTRO_KEY) === '1';
  } catch {
    return false;
  }
}

// The artist detail path is `/hub/booth/artists/<encoded-key>`; the
// roster is bare `/hub/booth/artists`. Returns the decoded key (`@acct` for
// a Kronk account, a name otherwise), or null on the roster / other views.
function artistFromPath(pathname: string): string | null {
  const match = /^\/hub\/booth\/artists\/(.+)$/.exec(pathname);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

// What an artist is addressed by: their account when they have one, the
// name otherwise.
const creditKey = (credit: BoothCredit): string =>
  credit.account ? `@${credit.account.acct}` : (credit.name ?? '').trim();

// Group the loaded sets into an artist roster: one entry per person, with
// their set count. A person is whoever uploaded a set or was credited on
// one (Tal 2026-10-12): a Kronk account, or a plain name for someone who is
// not on Kronk. The line an uploader typed on a set from before credits
// existed is not an artist. Sorted by set count, then name; never by
// plays, which are the artist's own business.
function deriveArtists(sets: BoothSet[]): BoothArtist[] {
  const byKey = new Map<string, BoothArtist>();
  for (const set of sets) {
    for (const credit of set.artists) {
      const key = creditKey(credit);
      if (!key) continue;
      const existing = byKey.get(key);
      if (existing) {
        existing.setCount += 1;
      } else {
        byKey.set(key, {
          key,
          name: credit.account?.display_name ?? credit.name ?? key,
          acct: credit.account?.acct,
          avatar: credit.account?.avatar,
          setCount: 1,
        });
      }
    }
  }
  return [...byKey.values()].sort(
    (a, b) => b.setCount - a.setCount || a.name.localeCompare(b.name),
  );
}

// The most used genres on the sets in hand, most used first.
function topGenres(sets: BoothSet[]): string[] {
  const counts = new Map<string, number>();
  for (const set of sets) {
    for (const genre of set.genres) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, GENRE_CHIPS)
    .map(([genre]) => genre);
}

// A grid of sets, with the owner's Edit / Share to feed flows from each
// card's menu. Every view uses it. Pressing play on a card queues the
// grid it's in, for Play next.
const SetGallery: React.FC<{
  sets: BoothSet[];
  onReplace: (set: BoothSet) => void;
  onRemove: (id: string) => void;
  badge?: string;
}> = ({ sets, onReplace, onRemove, badge }) => {
  const history = useHistory();
  const dispatch = useAppDispatch();
  const [editingSet, setEditingSet] = useState<BoothSet | null>(null);
  const [sharingSet, setSharingSet] = useState<BoothSet | null>(null);

  const handleOpen = useCallback(
    (set: BoothSet) => {
      history.push(`/hub/booth/sets/${set.id}`);
    },
    [history],
  );
  const handleEditSuccess = useCallback(
    (updated: BoothSet) => {
      onReplace(updated);
      setEditingSet(null);
    },
    [onReplace],
  );
  const handleShareSuccess = useCallback(() => {
    setSharingSet(null);
    dispatch(showAlert({ message: messages.shared }));
  }, [dispatch]);
  const handleCancelEdit = useCallback(() => {
    setEditingSet(null);
  }, []);
  const handleCancelShare = useCallback(() => {
    setSharingSet(null);
  }, []);

  return (
    <>
      <SpaceGrid className='booth-gallery'>
        {sets.map((set) => (
          <BoothGridCard
            key={set.id}
            set={set}
            onOpen={handleOpen}
            onEdit={setEditingSet}
            onDelete={onRemove}
            onShare={setSharingSet}
            onChange={onReplace}
            queue={sets}
            badge={badge}
          />
        ))}
      </SpaceGrid>
      {editingSet && (
        <EditForm
          set={editingSet}
          onSuccess={handleEditSuccess}
          onCancel={handleCancelEdit}
        />
      )}
      {sharingSet && (
        <ShareForm
          set={sharingSet}
          onSuccess={handleShareSuccess}
          onCancel={handleCancelShare}
        />
      )}
    </>
  );
};

// First-visit explainer: three lines on what the Booth is for and how a
// set gets heard. Dismissed once per browser.
const BoothIntro: React.FC = () => {
  const intl = useIntl();
  const [dismissed, setDismissed] = useState(readIntroDismissed);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    try {
      window.localStorage.setItem(INTRO_KEY, '1');
    } catch {
      // Private mode: it comes back next visit, which is fine.
    }
  }, []);

  if (dismissed) return null;

  return (
    <section className='booth-intro' aria-labelledby='booth-intro-title'>
      <h2 id='booth-intro-title' className='booth-intro__title'>
        {intl.formatMessage(messages.introTitle)}
      </h2>
      <ol className='booth-intro__steps'>
        <li>{intl.formatMessage(messages.introUpload)}</li>
        <li>{intl.formatMessage(messages.introShare)}</li>
        <li>{intl.formatMessage(messages.introCredit)}</li>
        <li>{intl.formatMessage(messages.introLive)}</li>
      </ol>
      <div className='booth-intro__actions'>
        <Link to='/hub/booth/composer' className='booth-intro__cta'>
          {intl.formatMessage(messages.upload)}
        </Link>
        <button
          type='button'
          className='booth-intro__dismiss'
          onClick={handleDismiss}
        >
          {intl.formatMessage(messages.introDismiss)}
        </button>
      </div>
    </section>
  );
};

const MusikView: React.FC = () => {
  const intl = useIntl();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState<string | null>(null);
  const [kind, setKind] = useState<BoothKind | null>(null);
  const [sort, setSort] = useState<BoothSort>('newest');
  const [genreChips, setGenreChips] = useState<string[]>([]);
  // "See all" on First listens turns the grid into that list.
  const [allFirst, setAllFirst] = useState(false);
  const { sets, loading, loadingMore, hasMore, loadMore, replace, remove } =
    useBoothSets({ query, genre, kind, sort, firstListens: allFirst });
  const filtering = query !== '' || genre !== null || kind !== null || allFirst;
  const first = useBoothSets({ firstListens: true });
  const firstBadge = intl.formatMessage(messages.firstListens);

  // Typing settles for a moment before it searches.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(input.trim());
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [input]);

  // The genre chips come from the unfiltered newest sets, and stay put
  // while a search or genre narrows the grid.
  useEffect(() => {
    if (!loading && !filtering) setGenreChips(topGenres(sets));
  }, [loading, filtering, sets]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  }, []);
  const handleClear = useCallback(() => {
    setInput('');
    setQuery('');
  }, []);
  const handleGenre = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    setGenre(e.currentTarget.dataset.genre ?? null);
  }, []);
  const handleKind = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    setKind((e.currentTarget.dataset.kind as BoothKind | undefined) ?? null);
  }, []);
  const handleSort = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    setSort(
      (e.currentTarget.dataset.sort as BoothSort | undefined) ?? 'newest',
    );
  }, []);
  // One filter panel open at a time; tapping its pill again closes it.
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const handleToggle = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const key = e.currentTarget.dataset.filter as FilterKey;
    setOpenFilter((open) => (open === key ? null : key));
  }, []);
  const handleAllFirst = useCallback(() => {
    setAllFirst(true);
  }, []);
  const handleEverything = useCallback(() => {
    setAllFirst(false);
  }, []);

  const nothingAtAll = !loading && !filtering && sets.length === 0;

  return (
    <>
      <BoothIntro />
      <LiveNowStrip />

      {/* First listens: recent sets few people have heard yet, up front so
          new voices get a first audience instead of a chart. */}
      {!filtering && first.sets.length > 0 && (
        <section className='booth-first'>
          <div className='booth-first__head'>
            <h2 className='booth-first__title'>
              {intl.formatMessage(messages.firstListens)}
            </h2>
            <p>{intl.formatMessage(messages.firstListensBody)}</p>
            {first.sets.length > FIRST_SHELF && (
              <KornerPill
                label={intl.formatMessage(messages.seeAll)}
                onClick={handleAllFirst}
              />
            )}
          </div>
          <SetGallery
            sets={first.sets.slice(0, FIRST_SHELF)}
            onReplace={first.replace}
            onRemove={first.remove}
            badge={firstBadge}
          />
        </section>
      )}

      {allFirst && (
        <div className='booth-first__head'>
          <h2 className='booth-first__title'>
            {intl.formatMessage(messages.firstListens)}
          </h2>
          <p>{intl.formatMessage(messages.firstListensBody)}</p>
          <KornerPill
            label={intl.formatMessage(messages.everything)}
            onClick={handleEverything}
          />
        </div>
      )}

      {!nothingAtAll && (
        <div className='booth-filters'>
          <div className='booth-search'>
            <Icon id='search' icon={SearchIcon} />
            <input
              type='search'
              value={input}
              onChange={handleInput}
              placeholder={intl.formatMessage(messages.search)}
              aria-label={intl.formatMessage(messages.search)}
            />
            {input && (
              <button
                type='button'
                onClick={handleClear}
                aria-label={intl.formatMessage(messages.clearSearch)}
              >
                <Icon id='close' icon={CloseIcon} />
              </button>
            )}
          </div>
          {/* Sort, Kind and Genre on one line, closed to start so the
              grid comes first. Each pill names its choice; opening one shows
              its chips in a panel under the row, one at a time. */}
          <div className='booth-filterbar'>
            <div className='booth-filterbar__toggles'>
              <button
                type='button'
                className={classNames('booth-filterbar__toggle', {
                  'booth-filterbar__toggle--set': sort !== 'newest',
                })}
                aria-expanded={openFilter === 'sort'}
                aria-controls='booth-filter-panel'
                data-filter='sort'
                onClick={handleToggle}
              >
                {intl.formatMessage(messages.sortChosen, {
                  sort: intl.formatMessage(SORT_MESSAGES[sort]),
                })}
              </button>
              <button
                type='button'
                className={classNames('booth-filterbar__toggle', {
                  'booth-filterbar__toggle--set': kind !== null,
                })}
                aria-expanded={openFilter === 'kind'}
                aria-controls='booth-filter-panel'
                data-filter='kind'
                onClick={handleToggle}
              >
                {kind
                  ? intl.formatMessage(messages.kindChosen, {
                      kind: intl.formatMessage(kindMessage(kind)),
                    })
                  : intl.formatMessage(messages.kindLabel)}
              </button>
              {genreChips.length > 1 && (
                <button
                  type='button'
                  className={classNames('booth-filterbar__toggle', {
                    'booth-filterbar__toggle--set': genre !== null,
                  })}
                  aria-expanded={openFilter === 'genre'}
                  aria-controls='booth-filter-panel'
                  data-filter='genre'
                  onClick={handleToggle}
                >
                  {genre
                    ? intl.formatMessage(messages.genreChosen, { genre })
                    : intl.formatMessage(messages.genreLabel)}
                </button>
              )}
            </div>

            {openFilter === 'sort' && (
              <div
                id='booth-filter-panel'
                className='booth-genres'
                role='group'
                aria-label={intl.formatMessage(messages.sortLabel)}
              >
                {SORTS.map((s) => (
                  <button
                    key={s}
                    type='button'
                    className='booth-genres__chip'
                    aria-pressed={sort === s}
                    data-sort={s}
                    onClick={handleSort}
                  >
                    {intl.formatMessage(SORT_MESSAGES[s])}
                  </button>
                ))}
              </div>
            )}

            {openFilter === 'kind' && (
              <div
                id='booth-filter-panel'
                className='booth-genres'
                role='group'
                aria-label={intl.formatMessage(messages.kinds)}
              >
                <button
                  type='button'
                  className='booth-genres__chip'
                  aria-pressed={kind === null}
                  onClick={handleKind}
                >
                  {intl.formatMessage(messages.allKinds)}
                </button>
                {KINDS.map((k) => (
                  <button
                    key={k}
                    type='button'
                    className='booth-genres__chip'
                    aria-pressed={kind === k}
                    data-kind={k}
                    onClick={handleKind}
                  >
                    {intl.formatMessage(kindMessage(k))}
                  </button>
                ))}
              </div>
            )}

            {openFilter === 'genre' && genreChips.length > 1 && (
              <div
                id='booth-filter-panel'
                className='booth-genres'
                role='group'
                aria-label={intl.formatMessage(messages.genres)}
              >
                <button
                  type='button'
                  className='booth-genres__chip'
                  aria-pressed={genre === null}
                  onClick={handleGenre}
                >
                  {intl.formatMessage(messages.allGenres)}
                </button>
                {genreChips.map((g) => (
                  <button
                    key={g}
                    type='button'
                    className='booth-genres__chip'
                    aria-pressed={genre === g}
                    data-genre={g}
                    onClick={handleGenre}
                  >
                    {g}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {loading && <LoadingState label={intl.formatMessage(messages.loading)} />}

      {nothingAtAll && (
        <EmptyState
          title={intl.formatMessage(messages.empty)}
          body={intl.formatMessage(messages.emptyBody)}
          action={
            <Link to='/hub/booth/composer'>
              {intl.formatMessage(messages.upload)}
            </Link>
          }
        />
      )}

      {!loading && filtering && sets.length === 0 && (
        <EmptyState
          title={intl.formatMessage(messages.noMatch)}
          body={intl.formatMessage(messages.noMatchBody)}
        />
      )}

      {!loading && sets.length > 0 && (
        <SetGallery
          sets={sets}
          onReplace={replace}
          onRemove={remove}
          badge={allFirst ? firstBadge : undefined}
        />
      )}

      {!loading && hasMore && (
        <KornerActionBar align='center'>
          <KornerPill
            label={intl.formatMessage(messages.loadMore)}
            onClick={loadMore}
            disabled={loadingMore}
          />
        </KornerActionBar>
      )}
    </>
  );
};

// My sets: a musician's own corner of the Booth. Their sets (drafts
// included) with plays, the live sets they've planned, and the sets
// they've saved. Saved is private to them.
const MySetsView: React.FC = () => {
  const intl = useIntl();
  const mine = useBoothSets({ scope: 'mine' });
  const saved = useBoothSets({ scope: 'saved' });
  const { lives } = useBoothLives();
  const myLives = lives.filter((l) => l.is_owner);
  const plays = mine.sets.reduce((sum, s) => sum + (s.play_count ?? 0), 0);
  const savedReplace = saved.replace;
  const savedRemove = saved.remove;

  // Unsaving from this list takes the set out of it.
  const handleSavedChange = useCallback(
    (set: BoothSet) => {
      if (set.saved) savedReplace(set);
      else savedRemove(set.id);
    },
    [savedReplace, savedRemove],
  );

  if (mine.loading || saved.loading) {
    return <LoadingState label={intl.formatMessage(messages.loading)} />;
  }

  const count = (n: number, more: boolean) => (more ? `${n}+` : String(n));

  return (
    <div className='booth-mine'>
      <dl className='booth-mine__stats'>
        <div>
          <dt>{intl.formatMessage(messages.mineSets)}</dt>
          <dd>{count(mine.sets.length, mine.hasMore)}</dd>
        </div>
        <div>
          <dt>{intl.formatMessage(messages.minePlays)}</dt>
          <dd>{intl.formatNumber(plays)}</dd>
        </div>
        <div>
          <dt>{intl.formatMessage(messages.mineLives)}</dt>
          <dd>{myLives.length}</dd>
        </div>
        <div>
          <dt>{intl.formatMessage(messages.mineSaved)}</dt>
          <dd>{count(saved.sets.length, saved.hasMore)}</dd>
        </div>
      </dl>

      <section>
        <h2 className='booth-set__section-title'>
          {intl.formatMessage(messages.mineSetsHeading)}
        </h2>
        {mine.sets.length > 0 ? (
          <SetGallery
            sets={mine.sets}
            onReplace={mine.replace}
            onRemove={mine.remove}
          />
        ) : (
          <EmptyState
            title={intl.formatMessage(messages.mineSetsEmpty)}
            action={
              <Link to='/hub/booth/composer'>
                {intl.formatMessage(messages.upload)}
              </Link>
            }
          />
        )}
      </section>

      <section>
        <h2 className='booth-set__section-title'>
          {intl.formatMessage(messages.mineLivesHeading)}
        </h2>
        {myLives.length > 0 ? (
          <ul className='booth-mine__lives'>
            {myLives.map((l) => (
              <LiveCard key={l.id} live={l} />
            ))}
          </ul>
        ) : (
          <EmptyState
            title={intl.formatMessage(messages.mineLivesEmpty)}
            action={
              <Link to='/hub/booth/composer/live'>
                {intl.formatMessage(messages.goLive)}
              </Link>
            }
          />
        )}
      </section>

      <section>
        <h2 className='booth-set__section-title'>
          {intl.formatMessage(messages.mineSavedHeading)}
        </h2>
        {saved.sets.length > 0 ? (
          <SetGallery
            sets={saved.sets}
            onReplace={handleSavedChange}
            onRemove={savedRemove}
          />
        ) : (
          <EmptyState
            title={intl.formatMessage(messages.mineSavedEmpty)}
            body={intl.formatMessage(messages.mineSavedEmptyBody)}
          />
        )}
      </section>
    </div>
  );
};

const ArtistsView: React.FC = () => {
  const intl = useIntl();
  const location = useLocation();
  const history = useHistory();
  const { sets, loading, replace, remove } = useBoothSets();
  const activeArtist = artistFromPath(location.pathname);
  const artists = useMemo(() => deriveArtists(sets), [sets]);
  const artistSets = useMemo(
    () =>
      activeArtist
        ? sets.filter((s) =>
            s.artists.some((credit) => creditKey(credit) === activeArtist),
          )
        : [],
    [sets, activeArtist],
  );
  const activeArtistStat = useMemo<BoothArtist | null>(
    () => artists.find((a) => a.key === activeArtist) ?? null,
    [activeArtist, artists],
  );

  const handleOpenArtist = useCallback(
    (key: string) => {
      history.push(`/hub/booth/artists/${encodeURIComponent(key)}`);
    },
    [history],
  );

  if (loading) {
    return <LoadingState label={intl.formatMessage(messages.loading)} />;
  }

  if (!activeArtist) {
    return artists.length === 0 ? (
      <EmptyState title={intl.formatMessage(messages.artistsEmpty)} />
    ) : (
      <div className='booth-roster'>
        {artists.map((a) => (
          <BoothArtistChip key={a.key} artist={a} onOpen={handleOpenArtist} />
        ))}
      </div>
    );
  }

  // No local ← Back — the Frame's SpaceBadge returns to /hub/booth.
  return (
    <div className='booth-artist-detail'>
      <div className='booth-artist-detail__hero'>
        <span className='booth-artist-detail__avatar' aria-hidden='true'>
          {activeArtistStat?.avatar ? (
            <img src={activeArtistStat.avatar} alt='' />
          ) : (
            artistInitial(activeArtistStat?.name ?? activeArtist)
          )}
        </span>
        <div className='booth-artist-detail__id'>
          <h2 className='booth-artist-detail__name'>
            {activeArtistStat?.acct ? (
              <Link to={`/@${activeArtistStat.acct}`}>
                {activeArtistStat.name}
              </Link>
            ) : (
              (activeArtistStat?.name ?? activeArtist)
            )}
          </h2>
          {activeArtistStat && (
            <div className='booth-artist-detail__stat'>
              {artistStatLabel(activeArtistStat)}
            </div>
          )}
        </div>
      </div>
      {artistSets.length > 0 ? (
        <SetGallery sets={artistSets} onReplace={replace} onRemove={remove} />
      ) : (
        <EmptyState title={intl.formatMessage(messages.artistsEmpty)} />
      )}
    </div>
  );
};

const Booth: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const { signedIn } = useIdentity();
  const location = useLocation();
  const history = useHistory();
  const dispatch = useAppDispatch();

  // The Ж menu's Upload a set (booth.yaml compose → /hub/booth/composer)
  // opens the composer over the page; `/hub/booth/new` is the legacy alias.
  const composing =
    signedIn &&
    (location.pathname.startsWith('/hub/booth/composer') ||
      location.pathname.startsWith('/hub/booth/new'));
  const goingLive =
    composing && location.pathname.startsWith('/hub/booth/composer/live');

  // A new set lands on its own page. If it went out to the feed, say so;
  // if not, the page offers to share it.
  const handleCreated = useCallback(
    (set: BoothSet, shared: boolean) => {
      if (shared) dispatch(showAlert({ message: messages.shared }));
      history.push(`/hub/booth/sets/${set.id}`, { justUploaded: !shared });
    },
    [dispatch, history],
  );
  const handleCancelUpload = useCallback(() => {
    history.push('/hub/booth');
  }, [history]);

  // A live set opens its room: the host's get-ready panel for "now", the
  // scheduled page for "later".
  const handleLiveCreated = useCallback(
    ({ live, announce }: LiveCreated) => {
      history.push(`/hub/booth/live/${live.id}`, { announce });
    },
    [history],
  );

  return (
    <KornerShell
      slug='booth'
      label={intl.formatMessage(messages.heading)}
      className='booth-native'
      defaultView='musik'
      views={{
        musik: () => <MusikView />,
        live: () => <LiveView />,
        mine: () => <MySetsView />,
        artists: () => <ArtistsView />,
      }}
    >
      <Helmet>
        <title>{intl.formatMessage(messages.heading)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>

      {goingLive && (
        <LiveComposer
          onCreated={handleLiveCreated}
          onCancel={handleCancelUpload}
        />
      )}
      {composing && !goingLive && (
        <BoothComposer
          onCreated={handleCreated}
          onCancel={handleCancelUpload}
        />
      )}

      <BoothDock />
    </KornerShell>
  );
};

// eslint-disable-next-line import/no-default-export
export default Booth;
