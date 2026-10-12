import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Link, useHistory, useLocation } from 'react-router-dom';

import api from 'mastodon/api';
import { SpaceGrid } from 'mastodon/components/space_grid';
import { Stage } from 'mastodon/components/stage';
import { useIdentity } from 'mastodon/identity_context';

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

// The Booth — Musik (grid of sets) + Artists (roster + per-artist
// detail). Both drive off the URL segment after `/hub/booth`.
// The manifest's `views:` list matches; Events / Live / Me were
// declared before their surfaces existed and shipped as
// "coming-soon" placeholders in the switcher, which read as broken
// nav — they're gone here and in the manifest. Add them back when
// their surfaces are built.

type Lens = 'musik' | 'artists';
const LENS_KEYS: readonly string[] = ['musik', 'artists'];

const messages = defineMessages({
  heading: { id: 'booth.title', defaultMessage: 'The Booth' },
  empty: {
    id: 'booth.empty',
    defaultMessage: 'No sets yet. Be the first to upload!',
  },
  loading: { id: 'booth.loading', defaultMessage: 'Loading sets…' },
  artistsEmpty: {
    id: 'booth.artists_empty',
    defaultMessage: 'No artists yet — publish a set to appear here.',
  },
});

function lensFromPath(pathname: string): Lens {
  const match = /^\/hub\/booth\/([a-z]+)/.exec(pathname);
  const seg = match?.[1];
  return seg && LENS_KEYS.includes(seg) ? (seg as Lens) : 'musik';
}

// The artist detail path is `/hub/booth/artists/<encoded-key>`; the
// roster is bare `/hub/booth/artists`. Returns the decoded key (`@acct` for
// a Kronk account, a name otherwise), or null on the roster / other lenses.
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
// both descending. Krates are omitted (no backend).
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

const Booth: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const { signedIn } = useIdentity();
  const location = useLocation();
  const history = useHistory();
  const lens = lensFromPath(location.pathname);

  const [sets, setSets] = useState<BoothSet[]>([]);
  const [loading, setLoading] = useState(true);
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

  // The Ж menu's Post button (booth.yaml compose → /hub/booth/composer)
  // is the single entry to the composer — there is no in-page create
  // button. The upload overlay is open exactly when the URL is the
  // canonical `/composer` or the legacy `/new` alias; closing it
  // (cancel or success) returns to /hub/booth.
  useEffect(() => {
    const onComposer =
      signedIn &&
      (location.pathname.startsWith('/hub/booth/composer') ||
        location.pathname.startsWith('/hub/booth/new'));
    setShowUpload(onComposer);
    if (onComposer) {
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

  const overlayOpen = showUpload || editingSet !== null || sharingSet !== null;

  return (
    <Stage label={intl.formatMessage(messages.heading)}>
      <Helmet>
        <title>{intl.formatMessage(messages.heading)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>

      <div className='booth-native'>
        {showUpload && (
          <BoothComposer
            onCreated={handleUploadSuccess}
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
              <SpaceGrid className='booth-gallery'>
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
              </SpaceGrid>
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
                  key={a.key}
                  artist={a}
                  onOpen={handleOpenArtist}
                />
              ))}
            </div>
          )}

        {!overlayOpen && lens === 'artists' && activeArtist && (
          <div className='booth-artist-detail'>
            {/* No local ← Back — the Frame's SpaceBadge in the SpaceNav
                slot returns to /hub/booth (the korner root). Users who
                want the artists list specifically can rotate one face
                at the root. (Tal 2026-08-12.) */}
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
              <SpaceGrid className='booth-gallery'>
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
              </SpaceGrid>
            ) : (
              <div className='booth-native__status'>
                {intl.formatMessage(messages.artistsEmpty)}
              </div>
            )}
          </div>
        )}
      </div>

      <BoothDock />
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default Booth;
