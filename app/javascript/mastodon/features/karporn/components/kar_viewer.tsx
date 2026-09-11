import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link, useHistory } from 'react-router-dom';

import LocationOnIcon from '@/material-icons/400-24px/location_on.svg?react';
import { apiDeleteKar } from 'mastodon/api/karporn';
import type { ApiKarJSON } from 'mastodon/api_types/karporn';
import { Avatar } from 'mastodon/components/avatar';
import { Icon } from 'mastodon/components/icon';
import { createAccountFromServerJSON } from 'mastodon/models/account';

const messages = defineMessages({
  description: {
    id: 'karporn.viewer.description',
    defaultMessage: 'About this car',
  },
  emptyPhotos: {
    id: 'karporn.viewer.empty_photos',
    defaultMessage: 'No photos yet.',
  },
  photos: {
    id: 'karporn.viewer.photos_count',
    defaultMessage: '{count, plural, one {# photo} other {# photos}}',
  },
  deleteKar: { id: 'karporn.viewer.delete', defaultMessage: 'Delete post' },
  deleteConfirm: {
    id: 'karporn.viewer.delete_confirm',
    defaultMessage:
      'Delete this car post and all its photos? This is permanent.',
  },
  openInMap: {
    id: 'karporn.viewer.open_in_map',
    defaultMessage: 'Open in Map',
  },
  visibilityPublic: {
    id: 'karporn.viewer.visibility_public',
    defaultMessage: 'Kronk',
  },
  visibilityOrbit: {
    id: 'karporn.viewer.visibility_orbit',
    defaultMessage: 'Orbit',
  },
  visibilityMates: {
    id: 'karporn.viewer.visibility_mates',
    defaultMessage: 'Mates',
  },
  visibilitySelfOnly: {
    id: 'karporn.viewer.visibility_self_only',
    defaultMessage: 'Just me',
  },
});

const VISIBILITY_LABEL = {
  public: messages.visibilityPublic,
  orbit: messages.visibilityOrbit,
  mates: messages.visibilityMates,
  self_only: messages.visibilitySelfOnly,
} as const;

interface Props {
  kar: ApiKarJSON;
  onChange?: (kar: ApiKarJSON) => void;
}

export const KarViewer: React.FC<Props> = ({ kar }) => {
  const intl = useIntl();
  const history = useHistory();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(() => {
    if (deleting) return;
    if (!window.confirm(intl.formatMessage(messages.deleteConfirm))) return;
    setDeleting(true);
    void (async () => {
      try {
        await apiDeleteKar(kar.id);
        history.replace('/hub/karporn');
      } catch {
        setDeleting(false);
      }
    })();
  }, [deleting, intl, kar.id, history]);

  const ownerAccount = createAccountFromServerJSON(kar.owner);
  const hasCoords = kar.location?.lat != null && kar.location.lng != null;

  return (
    <article className='karporn-viewer'>
      <header className='karporn-viewer__header'>
        <h1 className='karporn-viewer__title'>{kar.title}</h1>
        <div className='karporn-viewer__meta'>
          <span>
            {kar.year} {kar.make} {kar.model}
          </span>
          <span aria-hidden>·</span>
          <span>
            {intl.formatMessage(messages.photos, { count: kar.photo_count })}
          </span>
          <span aria-hidden>·</span>
          <span>{intl.formatMessage(VISIBILITY_LABEL[kar.visibility])}</span>
        </div>
        {kar.location && (
          <div className='karporn-viewer__location'>
            <Icon id='location_on' icon={LocationOnIcon} />
            <span>{kar.location.label ?? 'Location tagged'}</span>
            {hasCoords && (
              <Link
                to={`/hub/map?lat=${kar.location.lat}&lng=${kar.location.lng}`}
                className='karporn-viewer__location-link'
              >
                {intl.formatMessage(messages.openInMap)}
              </Link>
            )}
          </div>
        )}
        <div className='karporn-viewer__owner'>
          <Avatar account={ownerAccount} size={24} />
          <span>@{kar.owner.acct}</span>
        </div>
      </header>

      {kar.cover_url && (
        <img className='karporn-viewer__cover' src={kar.cover_url} alt='' />
      )}

      {kar.photos.length === 0 ? (
        <p className='karporn-viewer__empty'>
          {intl.formatMessage(messages.emptyPhotos)}
        </p>
      ) : (
        <ul className='karporn-viewer__grid'>
          {kar.photos.map((photo) => (
            <li key={photo.id} className='karporn-viewer__grid-item'>
              {photo.url ? (
                <img src={photo.url} alt={photo.caption ?? ''} />
              ) : (
                <div className='karporn-viewer__grid-item--dark' />
              )}
              {photo.caption && (
                <figcaption className='karporn-viewer__caption'>
                  {photo.caption}
                </figcaption>
              )}
            </li>
          ))}
        </ul>
      )}

      {kar.description && (
        <section className='karporn-viewer__description'>
          <h2>{intl.formatMessage(messages.description)}</h2>
          <p>{kar.description}</p>
        </section>
      )}

      {kar.is_owner && (
        <footer className='karporn-viewer__actions'>
          <button
            type='button'
            className='karporn-viewer__delete'
            onClick={handleDelete}
            disabled={deleting}
          >
            {intl.formatMessage(messages.deleteKar)}
          </button>
        </footer>
      )}
    </article>
  );
};
