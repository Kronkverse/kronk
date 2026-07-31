import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import ChevronLeftIcon from '@/material-icons/400-24px/chevron_left.svg?react';
import ChevronRightIcon from '@/material-icons/400-24px/chevron_right.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import { apiUpdatePhoto } from 'mastodon/api/albutts';
import type {
  ApiAlbumJSON,
  ApiAlbumPhotoJSON,
} from 'mastodon/api_types/albutts';
import { IconButton } from 'mastodon/components/icon_button';
import { useIdentity } from 'mastodon/identity_context';

import { CaptionText } from './caption_text';
import type { CaptionTextareaHandle } from './caption_textarea';
import { CaptionTextarea } from './caption_textarea';
import { PhotoReactionsPanel } from './photo_reactions_panel';

const CAPTION_MAX = 500;

const messages = defineMessages({
  close: { id: 'albutts.lightbox.close', defaultMessage: 'Close' },
  previous: {
    id: 'albutts.lightbox.previous',
    defaultMessage: 'Previous photo',
  },
  next: { id: 'albutts.lightbox.next', defaultMessage: 'Next photo' },
  editCaption: {
    id: 'albutts.lightbox.edit_caption',
    defaultMessage: 'Edit caption',
  },
  addCaption: {
    id: 'albutts.lightbox.add_caption',
    defaultMessage: 'Add a caption',
  },
  captionPlaceholder: {
    id: 'albutts.lightbox.caption_placeholder',
    defaultMessage: 'Add a description (optional)',
  },
  saveCaption: {
    id: 'albutts.lightbox.save_caption',
    defaultMessage: 'Save',
  },
  cancelCaption: {
    id: 'albutts.lightbox.cancel_caption',
    defaultMessage: 'Cancel',
  },
});

interface AlbumLightboxModalProps {
  photos: ApiAlbumPhotoJSON[];
  initialIndex: number;
  albumTitle: string;
  albumOwnerId: string;
  onClose: () => void;
  onPhotoChanged?: (photo: ApiAlbumPhotoJSON) => void;
}

export const AlbumLightboxModal: React.FC<AlbumLightboxModalProps> = ({
  photos,
  initialIndex,
  albumTitle,
  albumOwnerId,
  onClose,
  onPhotoChanged,
}) => {
  const intl = useIntl();
  const { accountId } = useIdentity();
  const [index, setIndex] = useState(() =>
    Math.max(0, Math.min(initialIndex, photos.length - 1)),
  );
  const [localPhotos, setLocalPhotos] = useState(photos);
  const [editing, setEditing] = useState(false);
  const [draftCaption, setDraftCaption] = useState('');
  const [savingCaption, setSavingCaption] = useState(false);
  const editTextareaRef = useRef<CaptionTextareaHandle>(null);

  useEffect(() => {
    if (editing) {
      editTextareaRef.current?.focus();
    }
  }, [editing]);

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

  // Leaving edit mode when the viewer navigates between photos.
  useEffect(() => {
    setEditing(false);
    setDraftCaption('');
    setSavingCaption(false);
  }, [index]);

  const startEditingCaption = useCallback(() => {
    if (!current) return;
    setDraftCaption(current.caption ?? '');
    setEditing(true);
  }, [current]);

  const cancelEditingCaption = useCallback(() => {
    setEditing(false);
    setDraftCaption('');
  }, []);

  const saveCaption = useCallback(() => {
    if (!current || savingCaption) return;
    setSavingCaption(true);
    void (async () => {
      try {
        const updated = await apiUpdatePhoto(current.id, {
          caption: draftCaption.trim(),
        });
        handlePhotoUpdated(updated);
        setEditing(false);
      } catch (err) {
        console.error('[albutts] update caption failed', err);
      } finally {
        setSavingCaption(false);
      }
    })();
  }, [current, draftCaption, handlePhotoUpdated, savingCaption]);

  const handleDraftChange = useCallback((value: string) => {
    setDraftCaption(value.slice(0, CAPTION_MAX));
  }, []);

  if (!current) return null;

  const hasPrev = index > 0;
  const hasNext = index < localPhotos.length - 1;
  const contributor = current.contributor;
  const credit = contributor.display_name || contributor.username;
  const canEditCaption =
    accountId !== undefined &&
    (accountId === contributor.id || accountId === albumOwnerId);

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
          {editing ? (
            <div className='albutts-lightbox__caption-edit'>
              <CaptionTextarea
                ref={editTextareaRef}
                className='albutts-lightbox__caption-textarea'
                value={draftCaption}
                onChange={handleDraftChange}
                placeholder={intl.formatMessage(messages.captionPlaceholder)}
                maxLength={CAPTION_MAX}
                rows={3}
                disabled={savingCaption}
              />
              <div className='albutts-lightbox__caption-actions'>
                <button
                  type='button'
                  className='albutts-lightbox__caption-cancel'
                  onClick={cancelEditingCaption}
                  disabled={savingCaption}
                >
                  {intl.formatMessage(messages.cancelCaption)}
                </button>
                <button
                  type='button'
                  className='albutts-lightbox__caption-save'
                  onClick={saveCaption}
                  disabled={savingCaption}
                >
                  {intl.formatMessage(messages.saveCaption)}
                </button>
              </div>
            </div>
          ) : current.caption ? (
            <div className='albutts-lightbox__caption'>
              <span className='albutts-lightbox__caption-text'>
                <CaptionText text={current.caption} />
              </span>
              {canEditCaption && (
                <IconButton
                  title={intl.formatMessage(messages.editCaption)}
                  icon='edit'
                  iconComponent={EditIcon}
                  onClick={startEditingCaption}
                />
              )}
            </div>
          ) : canEditCaption ? (
            <button
              type='button'
              className='albutts-lightbox__caption-add'
              onClick={startEditingCaption}
            >
              {intl.formatMessage(messages.addCaption)}
            </button>
          ) : null}
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
      albumOwnerId={album.owner.id}
      onClose={onClose}
    />
  );
};

// eslint-disable-next-line import/no-default-export
export default AlbumLightboxModalWrapper;
