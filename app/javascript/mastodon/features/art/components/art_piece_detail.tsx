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

import { availabilityLabel, pieceFacts, piecePrice } from '../details';

import { ArtPieceComposer } from './art_piece_composer';
import { ArtQuickViewer } from './art_quick_viewer';

const messages = defineMessages({
  toPortfolio: {
    id: 'art.detail.to_portfolio',
    defaultMessage: "{name}'s portfolio",
  },
  readMore: { id: 'art.detail.read_more', defaultMessage: 'Read more' },
  readLess: { id: 'art.detail.read_less', defaultMessage: 'Show less' },
  emptyPhotos: {
    id: 'art.detail.empty_photos',
    defaultMessage: 'No photos yet.',
  },
  mediums: { id: 'art.detail.mediums', defaultMessage: 'Mediums' },
  morePictures: {
    id: 'art.detail.more_pictures',
    defaultMessage: 'More pictures',
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
});

// A description longer than this folds to four lines behind Read more.
const ABOUT_FOLD = 280;

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
  const [aboutOpen, setAboutOpen] = useState(false);
  const toggleAbout = useCallback(() => {
    setAboutOpen((was) => !was);
  }, []);
  // Which picture the full-screen viewer has open.
  const [viewing, setViewing] = useState<number | null>(null);
  const openViewer = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    setViewing(Number(e.currentTarget.value));
  }, []);
  const closeViewer = useCallback(() => {
    setViewing(null);
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

  // Top to bottom (@mangobee, 2026-10-26): the main picture, whole; the
  // title; the artist's words about it; its mediums and details; then every other
  // picture. Any picture opens full screen in the quick viewer.
  const photos = piece.photos.filter((photo) => photo.url);
  const [main, ...more] = photos;
  const mainUrl = main?.url ?? piece.cover_url;
  const facts = pieceFacts(intl, piece);
  // For sale with a price: "Available · $1,200 AUD".
  const status = [
    availabilityLabel(intl, piece.availability),
    piecePrice(intl, piece),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <KornerDetail
      className='art-piece-detail'
      hero={
        mainUrl ? (
          <div className='art-piece-detail__media'>
            <button
              type='button'
              value={0}
              className='art-piece-detail__cover-button'
              onClick={openViewer}
              aria-label={intl.formatMessage(messages.fullScreen)}
            >
              <img
                className='art-piece-detail__cover'
                src={mainUrl}
                alt={main?.caption ?? ''}
              />
            </button>
            {main?.caption && (
              <p className='art-piece-detail__caption'>{main.caption}</p>
            )}
          </div>
        ) : null
      }
      title={piece.title}
      meta={
        <KornerMeta
          items={[
            // The artist's picture, which goes to their portfolio, where
            // the rest of their work is (@mangobee, 2026-10-26).
            <Link
              key='owner'
              to={`/hub/art/@${piece.owner.acct}`}
              className='art-piece-detail__artist'
              aria-label={intl.formatMessage(messages.toPortfolio, {
                name: piece.owner.display_name.trim() || piece.owner.username,
              })}
              title={intl.formatMessage(messages.toPortfolio, {
                name: piece.owner.display_name.trim() || piece.owner.username,
              })}
            >
              <img src={piece.owner.avatar} alt='' />
            </Link>,
          ]}
        />
      }
      attached={{ korner: 'art', id: piece.id, canManage: piece.is_owner }}
    >
      {confirmDialog}

      {!mainUrl && (
        <EmptyState title={intl.formatMessage(messages.emptyPhotos)} />
      )}

      {/* The artist's words straight under the title, like the label
          beside a work in a gallery (@mangobee, 2026-10-26). A long one
          folds to four lines behind Read more. */}
      {piece.description && (
        <div className='art-piece-detail__about'>
          <p
            className={`art-piece-detail__description${aboutOpen ? '' : ' art-piece-detail__description--folded'}`}
          >
            {piece.description}
          </p>
          {piece.description.length > ABOUT_FOLD && (
            <button
              type='button'
              className='art-piece-detail__read-more'
              onClick={toggleAbout}
              aria-expanded={aboutOpen}
            >
              {intl.formatMessage(
                aboutOpen ? messages.readLess : messages.readMore,
              )}
            </button>
          )}
        </div>
      )}

      {/* Its mediums lead back to the artist's portfolio, filtered to that
          medium (docs/spaces/art.md, Mediums); under them the gallery
          label: materials · size · year · edition, and the status. */}
      {(piece.mediums.length > 0 || facts.length > 0 || status) && (
        <section className='art-piece-detail__section'>
          <h2 className='art-piece-detail__heading'>
            {intl.formatMessage(messages.mediums)}
          </h2>
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
          {(facts.length > 0 || status) && (
            <p className='art-piece-detail__facts'>
              {facts.join(' · ')}
              {status && (
                <span
                  className={`art-piece-detail__status art-piece-detail__status--${piece.availability}`}
                >
                  {status}
                </span>
              )}
            </p>
          )}
        </section>
      )}

      {more.length > 0 && (
        <section className='art-piece-detail__section'>
          <h2 className='art-piece-detail__heading'>
            {intl.formatMessage(messages.morePictures)}
          </h2>
          <ul className='art-piece-detail__more'>
            {more.map((photo, i) => (
              <li key={photo.id}>
                <button
                  type='button'
                  value={i + 1}
                  onClick={openViewer}
                  className='art-piece-detail__more-photo'
                  aria-label={intl.formatMessage(messages.photoAt, {
                    at: i + 2,
                    total: photos.length,
                  })}
                >
                  <img src={photo.url ?? ''} alt='' loading='lazy' />
                </button>
                {photo.caption && (
                  <p className='art-piece-detail__caption'>{photo.caption}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {viewing !== null && (
        <ArtQuickViewer
          pieces={[piece]}
          initialIndex={0}
          initialPhoto={viewing}
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
