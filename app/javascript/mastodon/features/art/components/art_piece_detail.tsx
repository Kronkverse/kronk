import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link, useHistory } from 'react-router-dom';

import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import { apiDeletePiece } from 'mastodon/api/art';
import type { ApiArtPieceJSON } from 'mastodon/api_types/art';
import { EmptyState } from 'mastodon/components/empty_state';
import { KornerDetail } from 'mastodon/components/korner_detail';
import { KornerMeta } from 'mastodon/components/korner_meta';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';
import { useConfirmThen } from 'mastodon/hooks/useConfirmDialog';

import { availabilityLabel, pieceFacts } from '../details';

import { ArtPieceComposer } from './art_piece_composer';
import { ArtQuickViewer } from './art_quick_viewer';

const messages = defineMessages({
  description: {
    id: 'art.detail.description',
    defaultMessage: 'About this piece',
  },
  emptyPhotos: {
    id: 'art.detail.empty_photos',
    defaultMessage: 'No photos yet.',
  },
  fullScreen: {
    id: 'art.detail.full_screen',
    defaultMessage: 'See it full screen',
  },
  photoAt: {
    id: 'art.detail.photo_at',
    defaultMessage: 'Photo {at} of {total}',
  },
  editPiece: { id: 'art.page_action.edit', defaultMessage: 'Edit piece' },
  deleteConfirm: {
    id: 'art.detail.delete_confirm',
    defaultMessage: 'Delete this piece and all its photos? This is permanent.',
  },
  visibilityPublic: {
    id: 'art.detail.visibility_public',
    defaultMessage: 'Kronk',
  },
  visibilityOrbit: {
    id: 'art.detail.visibility_orbit',
    defaultMessage: 'Orbit',
  },
  visibilityMates: {
    id: 'art.detail.visibility_mates',
    defaultMessage: 'Mates',
  },
  visibilitySelfOnly: {
    id: 'art.detail.visibility_self_only',
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
  piece: ApiArtPieceJSON;
  onChange?: (piece: ApiArtPieceJSON) => void;
}

export const ArtPieceDetail: React.FC<Props> = ({ piece, onChange }) => {
  const intl = useIntl();
  const [confirmDialog, confirmThen] = useConfirmThen();
  const history = useHistory();
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [photoAt, setPhotoAt] = useState(0);
  const [viewing, setViewing] = useState(false);
  const pickPhoto = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    setPhotoAt(Number(e.currentTarget.value));
  }, []);
  const openViewer = useCallback(() => {
    setViewing(true);
  }, []);
  const closeViewer = useCallback(() => {
    setViewing(false);
  }, []);

  // Edit lives in the Ж menu (docs/design.md): the owner gets an Edit
  // piece moon, opening the create composer in edit mode. Delete sits
  // at the foot of that form; there is no inline Edit or Delete here.
  const handleStartEdit = useCallback(() => {
    setEditing(true);
  }, []);
  const handleEditCancel = useCallback(() => {
    setEditing(false);
  }, []);
  const handleUpdated = useCallback(
    (updated: ApiArtPieceJSON) => {
      onChange?.(updated);
      setEditing(false);
    },
    [onChange],
  );
  useRegisterPageAction(
    {
      key: 'edit',
      label: intl.formatMessage(messages.editPiece),
      icon: EditIcon,
      iconId: 'edit',
    },
    handleStartEdit,
    piece.is_owner && !editing,
  );

  const handleDelete = useCallback(() => {
    if (deleting) return;
    confirmThen(intl.formatMessage(messages.deleteConfirm), 'delete', () => {
      setDeleting(true);
      void (async () => {
        try {
          await apiDeletePiece(piece.id);
          history.replace('/hub/art');
        } catch {
          setDeleting(false);
        }
      })();
    });
  }, [deleting, intl, piece.id, history, confirmThen]);

  // The photo on show heads the page, whole; thumbnails under it switch it,
  // and tapping it opens it full screen in the quick viewer.
  const photos = piece.photos.filter((photo) => photo.url);
  const shown = photos[Math.min(photoAt, photos.length - 1)];
  const heroUrl = shown?.url ?? piece.cover_url;

  return (
    <KornerDetail
      className='art-piece-detail'
      hero={
        heroUrl ? (
          <div className='art-piece-detail__media'>
            <button
              type='button'
              className='art-piece-detail__cover-button'
              onClick={openViewer}
              aria-label={intl.formatMessage(messages.fullScreen)}
            >
              <img
                className='art-piece-detail__cover'
                src={heroUrl}
                alt={shown?.caption ?? ''}
              />
            </button>
            {photos.length > 1 && (
              <div className='art-piece-detail__thumbs'>
                {photos.map((photo, i) => (
                  <button
                    key={photo.id}
                    type='button'
                    value={i}
                    onClick={pickPhoto}
                    aria-pressed={photo.id === shown?.id}
                    aria-label={intl.formatMessage(messages.photoAt, {
                      at: i + 1,
                      total: photos.length,
                    })}
                    className={`art-piece-detail__thumb${photo.id === shown?.id ? ' art-piece-detail__thumb--on' : ''}`}
                  >
                    <img src={photo.url ?? ''} alt='' loading='lazy' />
                  </button>
                ))}
              </div>
            )}
            {shown?.caption && (
              <p className='art-piece-detail__caption'>{shown.caption}</p>
            )}
          </div>
        ) : null
      }
      title={piece.title}
      meta={
        <KornerMeta
          items={[
            // The artist's portfolio, where the rest of their work is.
            <Link key='owner' to={`/hub/art/@${piece.owner.acct}`}>
              @{piece.owner.acct}
            </Link>,
            piece.year_made ? String(piece.year_made) : null,
            // Who can see it: the artist's to know.
            piece.is_owner
              ? intl.formatMessage(VISIBILITY_LABEL[piece.visibility])
              : null,
          ]}
        />
      }
      attached={{ korner: 'art', id: piece.id, canManage: piece.is_owner }}
    >
      {confirmDialog}

      {/* Its mediums lead back to the artist's portfolio, filtered to that
          medium (docs/spaces/art.md, Mediums). */}
      {piece.mediums.length > 0 && (
        <div className='art-piece-detail__mediums'>
          {piece.mediums.map((name) => (
            <Link
              key={name}
              to={`/hub/art/@${piece.owner.acct}?medium=${encodeURIComponent(name)}`}
              className='art-piece-detail__medium'
            >
              {name}
            </Link>
          ))}
        </div>
      )}

      {/* The gallery label: materials · size · year · edition, then the
          status when it's anything but "not for sale". */}
      {(pieceFacts(intl, piece).length > 0 ||
        availabilityLabel(intl, piece.availability)) && (
        <p className='art-piece-detail__facts'>
          {pieceFacts(intl, piece).join(' · ')}
          {availabilityLabel(intl, piece.availability) && (
            <span
              className={`art-piece-detail__status art-piece-detail__status--${piece.availability}`}
            >
              {availabilityLabel(intl, piece.availability)}
            </span>
          )}
        </p>
      )}

      {!heroUrl && (
        <EmptyState title={intl.formatMessage(messages.emptyPhotos)} />
      )}

      {piece.description && (
        <section className='art-piece-detail__description'>
          <h2>{intl.formatMessage(messages.description)}</h2>
          <p>{piece.description}</p>
        </section>
      )}

      {viewing && (
        <ArtQuickViewer
          pieces={[piece]}
          initialIndex={0}
          initialPhoto={shown ? Math.max(0, photos.indexOf(shown)) : 0}
          medium={null}
          onPiecePage
          onClose={closeViewer}
        />
      )}

      {editing && (
        <ArtPieceComposer
          piece={piece}
          onCancel={handleEditCancel}
          onUpdated={handleUpdated}
          onDelete={handleDelete}
          deleting={deleting}
        />
      )}
    </KornerDetail>
  );
};
