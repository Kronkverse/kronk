import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import ChevronLeftIcon from '@/material-icons/400-24px/chevron_left.svg?react';
import ChevronRightIcon from '@/material-icons/400-24px/chevron_right.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import type {
  ApiAlbumJSON,
  ApiAlbumPhotoJSON,
} from 'mastodon/api_types/albutts';
import { IconButton } from 'mastodon/components/icon_button';

import { PhotoReactionsPanel } from './photo_reactions_panel';

const messages = defineMessages({
  close: { id: 'albutts.lightbox.close', defaultMessage: 'Close' },
  previous: { id: 'albutts.lightbox.previous', defaultMessage: 'Previous photo' },
  next: { id: 'albutts.lightbox.next', defaultMessage: 'Next photo' },
});

interface AlbumLightboxModalProps {
  photos: ApiAlbumPhotoJSON[];
  initialIndex: number;
  albumTitle: string;
  onClose: () => void;
  onPhotoChanged?: (photo: ApiAlbumPhotoJSON) => void;
}

export const AlbumLightboxModal: React.FC<AlbumLightboxModalProps> = ({
  photos,
  initialIndex,
  albumTitle,
  onClose,
  onPhotoChanged,
}) => {
  const intl = useIntl();
  const [index, setIndex] = useState(() =>
    Math.max(0, Math.min(initialIndex, photos.length - 1)),
  );
  const [localPhotos, setLocalPhotos] = useState(photos);

  useEffect(() => {
    setLocalPhotos(photos);
  }, [photos]);

  const current = localPhotos[index];

  const goPrev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : i));
  }, []);
  const goNext = useCallback(() => {
    setIndex((i) => (i < localPhotos.length - 1 ? i + 1 : i));
  }, [localPhotos.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [goNext, goPrev, onClose]);

  const handlePhotoUpdated = useCallback(
    (updated: ApiAlbumPhotoJSON) => {
      setLocalPhotos((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p)),
      );
      onPhotoChanged?.(updated);
    },
    [onPhotoChanged],
  );

  if (!current) return null;

  const hasPrev = index > 0;
  const hasNext = index < localPhotos.length - 1;
  const contributor = current.contributor;
  const credit = contributor.display_name || contributor.username;

  return (
    <div className='albutts-lightbox'>
      <div className='albutts-lightbox__topbar'>
        <div className='albutts-lightbox__title'>
          <span className='albutts-lightbox__album'>{albumTitle}</span>
          <span className='albutts-lightbox__counter'>
            {index + 1} / {localPhotos.length}
          </span>
        </div>
        <IconButton
          title={intl.formatMessage(messages.close)}
          icon='close'
          iconComponent={CloseIcon}
          onClick={onClose}
        />
      </div>

      <div className='albutts-lightbox__stage'>
        {hasPrev && (
          <button
            type='button'
            className='albutts-lightbox__nav albutts-lightbox__nav--prev'
            onClick={goPrev}
            aria-label={intl.formatMessage(messages.previous)}
          >
            <ChevronLeftIcon />
          </button>
        )}
        <div className='albutts-lightbox__frame'>
          {current.url ? (
            <img
              src={current.url}
              alt={current.caption ?? credit}
              className='albutts-lightbox__img'
            />
          ) : (
            <div className='albutts-lightbox__img albutts-lightbox__img--missing' />
          )}
          {current.caption && (
            <div className='albutts-lightbox__caption'>{current.caption}</div>
          )}
        </div>
        {hasNext && (
          <button
            type='button'
            className='albutts-lightbox__nav albutts-lightbox__nav--next'
            onClick={goNext}
            aria-label={intl.formatMessage(messages.next)}
          >
            <ChevronRightIcon />
          </button>
        )}
      </div>

      <PhotoReactionsPanel
        key={current.id}
        photo={current}
        onPhotoUpdated={handlePhotoUpdated}
      />
    </div>
  );
};

// Adapter modal — signature matches the openModal/'ALBUM_LIGHTBOX' contract.
// Kept as a default export because ModalRoot's MODAL_COMPONENTS registers
// components by name via lazy `import()`.
export const AlbumLightboxModalWrapper: React.FC<{
  album: ApiAlbumJSON;
  initialPhotoId?: string;
  onClose: () => void;
}> = ({ album, initialPhotoId, onClose }) => {
  const initialIndex = initialPhotoId
    ? Math.max(
        0,
        album.photos.findIndex((p) => p.id === initialPhotoId),
      )
    : 0;

  return (
    <AlbumLightboxModal
      photos={album.photos}
      initialIndex={initialIndex === -1 ? 0 : initialIndex}
      albumTitle={album.title}
      onClose={onClose}
    />
  );
};

export default AlbumLightboxModalWrapper;
