import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useHistory, useLocation } from 'react-router-dom';

import api from 'mastodon/api';
import { Stage } from 'mastodon/components/stage';
import { useIdentity } from 'mastodon/identity_context';

import {
  BoothArtistChip,
  artistInitial,
  artistStatLabel,
} from './components/booth_artist_chip';
import type { BoothArtist } from './components/booth_artist_chip';
import { BoothDock } from './components/booth_dock';
import { BoothGridCard } from './components/booth_grid_card';
import { EditForm } from './components/edit_form';
import { ShareForm } from './components/share_form';
import { UploadForm } from './components/upload_form';
import type { BoothSet } from './types';

// The Booth — native Musik lens (replaces the iframe prototype). The
// SpaceNav badge + intro come from the Frame; lenses are the manifest
// `views:` (Musik / Artists / Events / Live / Me) driven by the URL.
// Only Musik is built here — the others are coming-soon panels pending
// their own surfaces (Artists roster, Events/Nights, Live, Me).

type Lens = 'musik' | 'artists' | 'events' | 'live' | 'me';
const LENS_KEYS: readonly string[] = [
  'musik',
  'artists',
  'events',
  'live',
  'me',
];
type Size = 'compact' | 'standard' | 'large';
const SIZES: { key: Size; label: string }[] = [
  { key: 'compact', label: 'Compact' },
  { key: 'standard', label: 'Standard' },
  { key: 'large', label: 'Large' },
];

const messages = defineMessages({
  heading: { id: 'booth.title', defaultMessage: 'The Booth' },
  empty: {
    id: 'booth.empty',
    defaultMessage: 'No sets yet. Be the first to upload!',
  },
  loading: { id: 'booth.loading', defaultMessage: 'Loading sets…' },
  soon: {
    id: 'booth.lens_soon',
    defaultMessage: 'Coming soon — this lens lands in a follow-up.',
  },
  artistsEmpty: {
    id: 'booth.artists_empty',
    defaultMessage: 'No artists yet — publish a set to appear here.',
  },
  backToArtists: {
    id: 'booth.back_to_artists',
    defaultMessage: 'All artists',
  },
});

function lensFromPath(pathname: string): Lens {
  const match = /^\/hub\/booth\/([a-z]+)/.exec(pathname);
  const seg = match?.[1];
  return seg && LENS_KEYS.includes(seg) ? (seg as Lens) : 'musik';
}

// The artist detail path is `/hub/booth/artists/<encoded-name>`; the
// roster is bare `/hub/booth/artists`. Returns the decoded artist name,
// or null on the roster / other lenses.
function artistFromPath(pathname: string): string | null {
  const match = /^\/hub\/booth\/artists\/(.+)$/.exec(pathname);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

// Group the loaded sets into an artist roster: one entry per distinct
// `artist_name`, with set count + summed play count. Sorted by set count
// then plays, both descending. Krates are omitted (no backend).
function deriveArtists(sets: BoothSet[]): BoothArtist[] {
  const byName = new Map<string, BoothArtist>();
  for (const set of sets) {
    const name = set.artist_name.trim();
    if (!name) continue;
    const existing = byName.get(name);
    if (existing) {
      existing.setCount += 1;
      existing.totalPlays += set.play_count;
    } else {
      byName.set(name, {
        name,
        setCount: 1,
        totalPlays: set.play_count,
      });
    }
  }
  return [...byName.values()].sort(
    (a, b) => b.setCount - a.setCount || b.totalPlays - a.totalPlays,
  );
}

const Booth: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const { signedIn } = useIdentity();
  const location = useLocation();
  const history = useHistory();
  const lens = lensFromPath(location.pathname);

  const [sets, setSets] = useState<BoothSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useState<Size>('standard');
  const [editingSet, setEditingSet] = useState<BoothSet | null>(null);
  const [sharingSet, setSharingSet] = useState<BoothSet | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [shareToast, setShareToast] = useState(false);

  useEffect(() => {
    void api()
      .get<BoothSet[]>('/api/v1/booth_sets')
      .then((res) => {
        setSets(res.data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  // The Ӂ menu's Post button (booth.yaml compose → /hub/booth/new) is the
  // single entry to the composer — there is no in-page create button. The
  // upload overlay is open exactly when the URL is /hub/booth/new; closing
  // it (cancel or success) returns to /hub/booth.
  useEffect(() => {
    const onNew = signedIn && location.pathname.startsWith('/hub/booth/new');
    setShowUpload(onNew);
    if (onNew) {
      setEditingSet(null);
      setSharingSet(null);
    }
  }, [location.pathname, signedIn]);

  const handleOpen = useCallback(
    (set: BoothSet) => {
      history.push(`/hub/booth/sets/${set.id}`);
    },
    [history],
  );

  // Artists lens — roster derived from the loaded sets; detail is the
  // set of one artist, keyed off the URL tail.
  const activeArtist = artistFromPath(location.pathname);
  const artists = useMemo(() => deriveArtists(sets), [sets]);
  const artistSets = useMemo(
    () =>
      activeArtist
        ? sets.filter((s) => s.artist_name.trim() === activeArtist)
        : [],
    [sets, activeArtist],
  );
  const activeArtistStat = useMemo<BoothArtist | null>(
    () =>
      activeArtist
        ? {
            name: activeArtist,
            setCount: artistSets.length,
            totalPlays: artistSets.reduce((n, s) => n + s.play_count, 0),
          }
        : null,
    [activeArtist, artistSets],
  );

  const handleOpenArtist = useCallback(
    (name: string) => {
      history.push(`/hub/booth/artists/${encodeURIComponent(name)}`);
    },
    [history],
  );
  const handleBackToArtists = useCallback(() => {
    history.push('/hub/booth/artists');
  }, [history]);

  const handleEdit = useCallback((set: BoothSet) => {
    setSharingSet(null);
    setShowUpload(false);
    setEditingSet(set);
  }, []);

  const handleEditSuccess = useCallback((updated: BoothSet) => {
    setSets((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setEditingSet(null);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setSets((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleShare = useCallback((set: BoothSet) => {
    setEditingSet(null);
    setShowUpload(false);
    setSharingSet(set);
  }, []);

  const handleShareSuccess = useCallback(() => {
    setSharingSet(null);
    setShareToast(true);
    setTimeout(() => {
      setShareToast(false);
    }, 2500);
  }, []);

  const handleUploadSuccess = useCallback(
    (set: BoothSet) => {
      setSets((prev) => [set, ...prev]);
      history.push('/hub/booth');
    },
    [history],
  );

  const handleCancelUpload = useCallback(() => {
    history.push('/hub/booth');
  }, [history]);
  const handleCancelEdit = useCallback(() => {
    setEditingSet(null);
  }, []);
  const handleCancelShare = useCallback(() => {
    setSharingSet(null);
  }, []);

  const handleSizeCompact = useCallback(() => {
    setSize('compact');
  }, []);
  const handleSizeStandard = useCallback(() => {
    setSize('standard');
  }, []);
  const handleSizeLarge = useCallback(() => {
    setSize('large');
  }, []);
  const sizeHandlers: Record<Size, () => void> = {
    compact: handleSizeCompact,
    standard: handleSizeStandard,
    large: handleSizeLarge,
  };

  const overlayOpen = showUpload || editingSet !== null || sharingSet !== null;

  return (
    <Stage label={intl.formatMessage(messages.heading)}>
      <Helmet>
        <title>{intl.formatMessage(messages.heading)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>

      <div className='booth-native'>
        {showUpload && (
          <UploadForm
            onSuccess={handleUploadSuccess}
            onCancel={handleCancelUpload}
          />
        )}
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
        {shareToast && (
          <div className='booth-native__toast'>Shared to your feed</div>
        )}

        {!overlayOpen && lens === 'musik' && (
          <>
            <div className='booth-native__toolbar'>
              <div className='booth-seg' role='group' aria-label='Card size'>
                {SIZES.map((s) => (
                  <button
                    key={s.key}
                    type='button'
                    className='booth-seg__btn'
                    aria-pressed={size === s.key}
                    onClick={sizeHandlers[s.key]}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {loading && (
              <div className='booth-native__status'>
                {intl.formatMessage(messages.loading)}
              </div>
            )}
            {!loading && sets.length === 0 && (
              <div className='booth-native__status'>
                {intl.formatMessage(messages.empty)}
              </div>
            )}
            {!loading && sets.length > 0 && (
              <div className='booth-gallery' data-size={size}>
                {sets.map((set) => (
                  <BoothGridCard
                    key={set.id}
                    set={set}
                    onOpen={handleOpen}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onShare={handleShare}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Artists — roster (bare /hub/booth/artists) or one artist's sets */}
        {!overlayOpen && lens === 'artists' && !activeArtist && loading && (
          <div className='booth-native__status'>
            {intl.formatMessage(messages.loading)}
          </div>
        )}
        {!overlayOpen &&
          lens === 'artists' &&
          !activeArtist &&
          !loading &&
          artists.length === 0 && (
            <div className='booth-native__status'>
              {intl.formatMessage(messages.artistsEmpty)}
            </div>
          )}
        {!overlayOpen &&
          lens === 'artists' &&
          !activeArtist &&
          !loading &&
          artists.length > 0 && (
            <div className='booth-roster'>
              {artists.map((a) => (
                <BoothArtistChip
                  key={a.name}
                  artist={a}
                  onOpen={handleOpenArtist}
                />
              ))}
            </div>
          )}

        {!overlayOpen && lens === 'artists' && activeArtist && (
          <div className='booth-artist-detail'>
            <button
              type='button'
              className='booth-artist-detail__back'
              onClick={handleBackToArtists}
            >
              {`← ${intl.formatMessage(messages.backToArtists)}`}
            </button>
            <div className='booth-artist-detail__hero'>
              <span className='booth-artist-detail__avatar' aria-hidden='true'>
                {artistInitial(activeArtist)}
              </span>
              <div className='booth-artist-detail__id'>
                <h2 className='booth-artist-detail__name'>{activeArtist}</h2>
                {activeArtistStat && (
                  <div className='booth-artist-detail__stat'>
                    {artistStatLabel(activeArtistStat)}
                  </div>
                )}
              </div>
            </div>
            {artistSets.length > 0 ? (
              <div className='booth-gallery' data-size='standard'>
                {artistSets.map((set) => (
                  <BoothGridCard
                    key={set.id}
                    set={set}
                    onOpen={handleOpen}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onShare={handleShare}
                  />
                ))}
              </div>
            ) : (
              <div className='booth-native__status'>
                {intl.formatMessage(messages.artistsEmpty)}
              </div>
            )}
          </div>
        )}

        {/* Events / Live / Me — still coming soon (later PRs) */}
        {!overlayOpen &&
          (lens === 'events' || lens === 'live' || lens === 'me') && (
            <div className='booth-native__soon'>
              {intl.formatMessage(messages.soon)}
            </div>
          )}
      </div>

      <BoothDock />
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default Booth;
