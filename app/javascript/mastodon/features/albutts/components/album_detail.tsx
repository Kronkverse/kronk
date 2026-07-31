import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link, useLocation } from 'react-router-dom';

import { openModal } from 'mastodon/actions/modal';
import { apiGetAlbum } from 'mastodon/api/albutts';
import type {
  ApiAlbumJSON,
  ApiAlbumPhotoJSON,
} from 'mastodon/api_types/albutts';
import { Avatar } from 'mastodon/components/avatar';
import { createAccountFromServerJSON } from 'mastodon/models/account';
import { useAppDispatch } from 'mastodon/store';

import { CaptionText } from './caption_text';
import { ContributeComposer } from './contribute_composer';

const messages = defineMessages({
  back: {
    id: 'albutts.detail.back',
    defaultMessage: '← Albums',
  },
  addPhoto: {
    id: 'albutts.detail.add_photo',
    defaultMessage: 'Add photos',
  },
  emptyPhotos: {
    id: 'albutts.detail.empty_photos',
    defaultMessage: 'No photos yet. Be first.',
  },
  photos: {
    id: 'albutts.detail.photos_count',
    defaultMessage: '{count, plural, one {# photo} other {# photos}}',
  },
  contributors: {
    id: 'albutts.detail.contributors_count',
    defaultMessage:
      '{count, plural, one {# contributor} other {# contributors}}',
  },
  visibilityPublic: {
    id: 'albutts.detail.visibility_public',
    defaultMessage: 'Kronk',
  },
  visibilityOrbit: {
    id: 'albutts.detail.visibility_orbit',
    defaultMessage: 'Orbit',
  },
  visibilityMates: {
    id: 'albutts.detail.visibility_mates',
    defaultMessage: 'Mates',
  },
  visibilitySelfOnly: {
    id: 'albutts.detail.visibility_self_only',
    defaultMessage: 'Just me',
  },
  visibilityKrew: {
    id: 'albutts.detail.visibility_krew',
    defaultMessage: 'Krew-scoped',
  },
});

const VISIBILITY_LABEL = {
  public: messages.visibilityPublic,
  orbit: messages.visibilityOrbit,
  mates: messages.visibilityMates,
  self_only: messages.visibilitySelfOnly,
  krew: messages.visibilityKrew,
} as const;

interface AlbumDetailProps {
  album: ApiAlbumJSON;
  onChange?: (album: ApiAlbumJSON) => void;
}

export const AlbumDetail: React.FC<AlbumDetailProps> = ({
  album,
  onChange,
}) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const location = useLocation();
  const [contributeOpen, setContributeOpen] = useState(false);

  const openLightbox = useCallback(
    (photoId: string) => {
      dispatch(
        openModal({
          modalType: 'ALBUM_LIGHTBOX',
          modalProps: { album, initialPhotoId: photoId },
        }),
      );
    },
    [album, dispatch],
  );

  // Deep-link support — Nudges CTAs land on
  // `/hub/albutts/albums/:id?photo=:photoId`. Open the lightbox
  // on that photo once the album has loaded.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const photoId = params.get('photo');
    if (!photoId) return;
    if (!album.photos.some((p) => p.id === photoId)) return;
    openLightbox(photoId);
    // Only fire once per query-string change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, album.id]);

  const openContribute = useCallback(() => {
    setContributeOpen(true);
  }, []);
  const closeContribute = useCallback(() => {
    setContributeOpen(false);
  }, []);

  const handleContributed = useCallback(() => {
    setContributeOpen(false);
    if (!onChange) return;
    void (async () => {
      try {
        const fresh = await apiGetAlbum(album.id);
        onChange(fresh);
      } catch {
        // Silent refresh failure — the composer still closed and the
        // photo POST succeeded server-side; a manual reload will
        // catch up.
      }
    })();
  }, [album.id, onChange]);

  const ownerAccount = createAccountFromServerJSON(album.owner);
  const ownerName = ownerAccount.display_name || ownerAccount.username;

  return (
    <div className='albutts-detail'>
      <div className='albutts-detail__crumbs'>
        <Link to='/hub/albutts' className='albutts-detail__crumb'>
          {intl.formatMessage(messages.back)}
        </Link>
      </div>

      <header className='albutts-detail__header'>
        {album.cover_url && (
          <div
            className='albutts-detail__cover'
            style={{ backgroundImage: `url(${album.cover_url})` }}
            aria-hidden
          />
        )}
        <div className='albutts-detail__header-body'>
          <h1 className='albutts-detail__title'>{album.title}</h1>
          {album.description && (
            <p className='albutts-detail__description'>{album.description}</p>
          )}
          <div className='albutts-detail__meta'>
            <span className='albutts-detail__owner'>
              <Avatar account={ownerAccount} size={22} /> {ownerName}
            </span>
            <span>
              {intl.formatMessage(VISIBILITY_LABEL[album.visibility])}
            </span>
            <span>
              {intl.formatMessage(messages.photos, {
                count: album.photo_count,
              })}
            </span>
            <span>
              {intl.formatMessage(messages.contributors, {
                count: album.contributor_count,
              })}
            </span>
          </div>
        </div>
      </header>

      {album.can_contribute && (
        <div className='albutts-detail__toolbar'>
          <button
            type='button'
            className='albutts-btn albutts-btn--primary'
            onClick={openContribute}
          >
            {intl.formatMessage(messages.addPhoto)}
          </button>
        </div>
      )}

      {album.photos.length === 0 ? (
        <p className='space-subtitle albutts-detail__empty'>
          {intl.formatMessage(messages.emptyPhotos)}
        </p>
      ) : (
        <ul className='albutts-detail__grid'>
          {album.photos.map((p) => (
            <PhotoTile key={p.id} photo={p} onOpen={openLightbox} />
          ))}
        </ul>
      )}

      {contributeOpen && (
        <ContributeComposer
          albumId={album.id}
          onCancel={closeContribute}
          onContributed={handleContributed}
        />
      )}
    </div>
  );
};

const PhotoTile: React.FC<{
  photo: ApiAlbumPhotoJSON;
  onOpen: (photoId: string) => void;
}> = ({ photo, onOpen }) => {
  const contributor = createAccountFromServerJSON(photo.contributor);
  const name = contributor.display_name || contributor.username;
  const handleClick = useCallback(() => {
    onOpen(photo.id);
  }, [onOpen, photo.id]);

  return (
    <li className='albutts-photo'>
      <button
        type='button'
        className='albutts-photo__trigger'
        onClick={handleClick}
        aria-label={photo.caption ?? name}
      >
        {photo.url ? (
          <img
            className='albutts-photo__img'
            src={photo.url}
            alt={photo.caption ?? name}
          />
        ) : (
          <div className='albutts-photo__img albutts-photo__img--missing' />
        )}
      </button>
      <div className='albutts-photo__meta'>
        <Avatar account={contributor} size={22} />
        <span className='albutts-photo__credit'>{name}</span>
        {(photo.status.favorites_count > 0 ||
          photo.status.replies_count > 0) && (
          <span className='albutts-photo__reactions'>
            {photo.status.favorites_count > 0 && (
              <span className='albutts-photo__reactions-item'>
                ♥ {photo.status.favorites_count}
              </span>
            )}
            {photo.status.replies_count > 0 && (
              <span className='albutts-photo__reactions-item'>
                💬 {photo.status.replies_count}
              </span>
            )}
          </span>
        )}
      </div>
      {photo.caption && (
        <div className='albutts-photo__caption'>
          <CaptionText text={photo.caption} />
        </div>
      )}
    </li>
  );
};
