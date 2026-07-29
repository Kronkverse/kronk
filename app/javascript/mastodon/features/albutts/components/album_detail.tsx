import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import { apiGetAlbum } from 'mastodon/api/albutts';
import type {
  ApiAlbumJSON,
  ApiAlbumPhotoJSON,
} from 'mastodon/api_types/albutts';
import { Avatar } from 'mastodon/components/avatar';
import { createAccountFromServerJSON } from 'mastodon/models/account';

import { ContributeComposer } from './contribute_composer';

const messages = defineMessages({
  back: {
    id: 'albutts.detail.back',
    defaultMessage: '← Albums',
  },
  addPhoto: {
    id: 'albutts.detail.add_photo',
    defaultMessage: 'Add a photo',
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
    defaultMessage: 'Public',
  },
  visibilityMates: {
    id: 'albutts.detail.visibility_mates',
    defaultMessage: 'Mates only',
  },
  visibilityKrew: {
    id: 'albutts.detail.visibility_krew',
    defaultMessage: 'Krew-scoped',
  },
});

const VISIBILITY_LABEL = {
  public: messages.visibilityPublic,
  mates: messages.visibilityMates,
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
  const [contributeOpen, setContributeOpen] = useState(false);

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
            <PhotoTile key={p.id} photo={p} />
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

const PhotoTile: React.FC<{ photo: ApiAlbumPhotoJSON }> = ({ photo }) => {
  const contributor = createAccountFromServerJSON(photo.contributor);
  const name = contributor.display_name || contributor.username;

  return (
    <li className='albutts-photo'>
      {photo.url ? (
        <img
          className='albutts-photo__img'
          src={photo.url}
          alt={photo.caption ?? name}
        />
      ) : (
        <div className='albutts-photo__img albutts-photo__img--missing' />
      )}
      <div className='albutts-photo__meta'>
        <Avatar account={contributor} size={22} />
        <span className='albutts-photo__credit'>{name}</span>
      </div>
      {photo.caption && (
        <div className='albutts-photo__caption'>{photo.caption}</div>
      )}
    </li>
  );
};
