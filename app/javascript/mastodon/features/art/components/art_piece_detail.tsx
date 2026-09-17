import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import { apiDeletePiece, apiGetPiece } from 'mastodon/api/art';
import type { ApiArtPieceJSON } from 'mastodon/api_types/art';
import { Avatar } from 'mastodon/components/avatar';
import { createAccountFromServerJSON } from 'mastodon/models/account';

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
  deletePiece: {
    id: 'art.detail.delete',
    defaultMessage: 'Delete piece',
  },
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
  const history = useHistory();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(() => {
    if (deleting) return;
    if (!window.confirm(intl.formatMessage(messages.deleteConfirm))) return;
    setDeleting(true);
    void (async () => {
      try {
        await apiDeletePiece(piece.id);
        history.replace('/hub/art');
      } catch {
        setDeleting(false);
      }
    })();
  }, [deleting, intl, piece.id, history]);

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
            className='art-piece-detail__delete'
            onClick={handleDelete}
            disabled={deleting}
          >
            {intl.formatMessage(messages.deletePiece)}
          </button>
          <button
            type='button'
            className='art-piece-detail__refresh'
            onClick={handleRefresh}
          >
            Refresh
          </button>
        </footer>
      )}
    </article>
  );
};
