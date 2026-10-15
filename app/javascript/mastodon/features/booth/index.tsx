import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

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
import { ShareForm } from './components/share_form';
import type { BoothCredit, BoothSet } from './types';
import { useBoothSets } from './use_booth_sets';

// The Booth — Musik (every set, searchable by title, artist or genre)
// and Artists (the people behind them). Both are views of the manifest
// (`config/korners/booth.yaml`), routed by `<KornerShell>` from the URL
// segment after `/hub/booth`; the Frame draws the title rotator.
//
// Uploading is the Ж menu's "Upload a set" (`/hub/booth/composer`); the
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
  allGenres: { id: 'booth.genre_all', defaultMessage: 'All' },
  genres: { id: 'booth.genres', defaultMessage: 'Genres' },
  loadMore: { id: 'booth.load_more', defaultMessage: 'Load more sets' },
  artistsEmpty: {
    id: 'booth.artists_empty',
    defaultMessage: 'No artists yet — publish a set to appear here.',
  },
  shared: { id: 'booth.shared', defaultMessage: 'Shared to your feed' },
  introTitle: {
    id: 'booth.intro.title',
    defaultMessage: 'How the Booth works',
  },
  introUpload: {
    id: 'booth.intro.upload',
    defaultMessage:
      'Upload a set from the Ж menu: the audio file, a title and a cover. That’s all it needs.',
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
  introDismiss: { id: 'booth.intro.dismiss', defaultMessage: 'Got it' },
});

const INTRO_KEY = 'kronk.booth.intro_dismissed';
const GENRE_CHIPS = 8;

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
// set count + summed play count. A person is whoever uploaded a set or was
// credited on one (Tal 2026-10-12): a Kronk account, or a plain name for
// someone who is not on Kronk. The line an uploader typed on a set from
// before credits existed is not an artist. Sorted by set count then plays,
// both descending.
function deriveArtists(sets: BoothSet[]): BoothArtist[] {
  const byKey = new Map<string, BoothArtist>();
  for (const set of sets) {
    for (const credit of set.artists) {
      const key = creditKey(credit);
      if (!key) continue;
      const existing = byKey.get(key);
      if (existing) {
        existing.setCount += 1;
        existing.totalPlays += set.play_count;
      } else {
        byKey.set(key, {
          key,
          name: credit.account?.display_name ?? credit.name ?? key,
          acct: credit.account?.acct,
          avatar: credit.account?.avatar,
          setCount: 1,
          totalPlays: set.play_count,
        });
      }
    }
  }
  return [...byKey.values()].sort(
    (a, b) => b.setCount - a.setCount || b.totalPlays - a.totalPlays,
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
// card's menu. Both views use it.
const SetGallery: React.FC<{
  sets: BoothSet[];
  onReplace: (set: BoothSet) => void;
  onRemove: (id: string) => void;
}> = ({ sets, onReplace, onRemove }) => {
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
  const [genreChips, setGenreChips] = useState<string[]>([]);
  const { sets, loading, loadingMore, hasMore, loadMore, replace, remove } =
    useBoothSets({ query, genre });
  const filtering = query !== '' || genre !== null;

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

  const nothingAtAll = !loading && !filtering && sets.length === 0;

  return (
    <>
      <BoothIntro />

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
          {genreChips.length > 1 && (
            <div
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
        <SetGallery sets={sets} onReplace={replace} onRemove={remove} />
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

  return (
    <KornerShell
      slug='booth'
      label={intl.formatMessage(messages.heading)}
      className='booth-native'
      defaultView='musik'
      views={{
        musik: () => <MusikView />,
        artists: () => <ArtistsView />,
      }}
    >
      <Helmet>
        <title>{intl.formatMessage(messages.heading)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>

      {composing && (
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
