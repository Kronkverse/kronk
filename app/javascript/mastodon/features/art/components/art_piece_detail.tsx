import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import { apiDeletePiece, apiGetPiece } from 'mastodon/api/art';
import type { ApiArtPieceJSON } from 'mastodon/api_types/art';
import { Avatar } from 'mastodon/components/avatar';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';
import { useConfirmThen } from 'mastodon/hooks/useConfirmDialog';
import { createAccountFromServerJSON } from 'mastodon/models/account';

import { ArtPieceComposer } from './art_piece_composer';

const messages = defineMessages({
  description: {
    id: 'art.detail.description',
    defaultMessage: 'About this piece',
  },
  emptyPhotos: {
    id: 'art.detail.empty_photos',
    defaultMessage: 'No photos yet.',
  },
  photos: {
    id: 'art.detail.photos_count',
    defaultMessage: '{count, plural, one {# photo} other {# photos}}',
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
  kindPainting: { id: 'art.detail.kind_painting', defaultMessage: 'Painting' },
  kindSculpture: {
    id: 'art.detail.kind_sculpture',
    defaultMessage: 'Sculpture',
  },
  kindPrint: { id: 'art.detail.kind_print', defaultMessage: 'Print' },
  kindDrawing: { id: 'art.detail.kind_drawing', defaultMessage: 'Drawing' },
  kindCeramic: { id: 'art.detail.kind_ceramic', defaultMessage: 'Ceramic' },
  kindPhotograph: {
    id: 'art.detail.kind_photograph',
    defaultMessage: 'Photograph',
  },
  kindOther: { id: 'art.detail.kind_other', defaultMessage: 'Other' },
});

const VISIBILITY_LABEL = {
  public: messages.visibilityPublic,
  orbit: messages.visibilityOrbit,
  mates: messages.visibilityMates,
  self_only: messages.visibilitySelfOnly,
} as const;

const KIND_LABEL: Record<ApiArtPieceJSON['kind'], typeof messages.kindOther> = {
  painting: messages.kindPainting,
  sculpture: messages.kindSculpture,
  print: messages.kindPrint,
  drawing: messages.kindDrawing,
  ceramic: messages.kindCeramic,
  photograph: messages.kindPhotograph,
  other: messages.kindOther,
};

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

  const handleRefresh = useCallback(() => {
    void (async () => {
      try {
        const fresh = await apiGetPiece(piece.id);
        onChange?.(fresh);
      } catch {
        // silent — the piece is still readable from the state we already have
      }
    })();
  }, [piece.id, onChange]);

  const ownerAccount = createAccountFromServerJSON(piece.owner);

  return (
    <article className='art-piece-detail'>
      {confirmDialog}
      <header className='art-piece-detail__header'>
        <h1 className='art-piece-detail__title'>{piece.title}</h1>
        <div className='art-piece-detail__meta'>
          <span>{intl.formatMessage(KIND_LABEL[piece.kind])}</span>
          <span aria-hidden>·</span>
          <span>
            {intl.formatMessage(messages.photos, {
              count: piece.photo_count,
            })}
          </span>
          <span aria-hidden>·</span>
          <span>{intl.formatMessage(VISIBILITY_LABEL[piece.visibility])}</span>
        </div>
        <div className='art-piece-detail__owner'>
          <Avatar account={ownerAccount} size={24} />
          <span>@{piece.owner.acct}</span>
        </div>
      </header>

      {piece.cover_url && (
        <img className='art-piece-detail__cover' src={piece.cover_url} alt='' />
      )}

      {piece.photos.length === 0 ? (
        <p className='art-piece-detail__empty'>
          {intl.formatMessage(messages.emptyPhotos)}
        </p>
      ) : (
        <ul className='art-piece-detail__grid'>
          {piece.photos.map((photo) => (
            <li key={photo.id} className='art-piece-detail__grid-item'>
              {photo.url ? (
                <img src={photo.url} alt={photo.caption ?? ''} />
              ) : (
                <div className='art-piece-detail__grid-item--dark' />
              )}
              {photo.caption && (
                <figcaption className='art-piece-detail__caption'>
                  {photo.caption}
                </figcaption>
              )}
            </li>
          ))}
        </ul>
      )}

      {piece.description && (
        <section className='art-piece-detail__description'>
          <h2>{intl.formatMessage(messages.description)}</h2>
          <p>{piece.description}</p>
        </section>
      )}

      {piece.is_owner && (
        <footer className='art-piece-detail__actions'>
          <button
            type='button'
            className='art-piece-detail__refresh'
            onClick={handleRefresh}
          >
            Refresh
          </button>
        </footer>
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
    </article>
  );
};
