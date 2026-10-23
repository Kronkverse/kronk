import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link, useHistory } from 'react-router-dom';

import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import { apiDeletePiece } from 'mastodon/api/art';
import type { ApiArtPieceJSON } from 'mastodon/api_types/art';
import { KornerDetail } from 'mastodon/components/korner_detail';
import { KornerMeta } from 'mastodon/components/korner_meta';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';
import { useConfirmThen } from 'mastodon/hooks/useConfirmDialog';

import { artKindLabel } from '../kinds';

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

  // The first photo is the cover: it heads the page, and the rest follow
  // under the title. (The grid used to repeat it under the cover.)
  const [cover, ...rest] = piece.photos;
  const heroUrl = cover?.url ?? piece.cover_url;

  return (
    <KornerDetail
      className='art-piece-detail'
      hero={
        heroUrl ? (
          <img
            className='art-piece-detail__cover'
            src={heroUrl}
            alt={cover?.caption ?? ''}
          />
        ) : null
      }
      title={piece.title}
      meta={
        <KornerMeta
          items={[
            artKindLabel(intl, piece.kind),
            intl.formatMessage(messages.photos, { count: piece.photo_count }),
            intl.formatMessage(VISIBILITY_LABEL[piece.visibility]),
            // The artist's portfolio, where the rest of their work is.
            <Link key='owner' to={`/hub/art/@${piece.owner.acct}`}>
              @{piece.owner.acct}
            </Link>,
          ]}
        />
      }
      attached={{ korner: 'art', id: piece.id, canManage: piece.is_owner }}
    >
      {confirmDialog}

      {!heroUrl && (
        <p className='art-piece-detail__empty'>
          {intl.formatMessage(messages.emptyPhotos)}
        </p>
      )}

      {rest.length > 0 && (
        <ul className='art-piece-detail__grid'>
          {rest.map((photo) => (
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
