import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import classNames from 'classnames';
import { useHistory, useLocation } from 'react-router-dom';

import DoneIcon from '@/material-icons/400-24px/done.svg?react';
import ChecklistIcon from '@/material-icons/400-24px/done_all.svg?react';
import DownloadIcon from '@/material-icons/400-24px/download.svg?react';
import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import { showAlert } from 'mastodon/actions/alerts';
import { importFetchedStatuses } from 'mastodon/actions/importer';
import { openModal } from 'mastodon/actions/modal';
import { apiGetAlbum } from 'mastodon/api/albutts';
import type {
  ApiAlbumJSON,
  ApiAlbumPhotoJSON,
} from 'mastodon/api_types/albutts';
import { Avatar } from 'mastodon/components/avatar';
import { Icon } from 'mastodon/components/icon';
import { StatusEngagement } from 'mastodon/components/status_engagement';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';
import { useIdentity } from 'mastodon/identity_context';
import { createAccountFromServerJSON } from 'mastodon/models/account';
import { useAppDispatch } from 'mastodon/store';

import { AlbumComposer } from './album_composer';
import { CaptionText } from './caption_text';
import { ContributeComposer } from './contribute_composer';

const messages = defineMessages({
  editAlbum: {
    id: 'albutts.detail.edit',
    defaultMessage: 'Edit album',
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
  downloadAlbum: {
    id: 'albutts.detail.download_album',
    defaultMessage: 'Download album',
  },
  selectPhotos: {
    id: 'albutts.detail.select_photos',
    defaultMessage: 'Select photos',
  },
  selectedCount: {
    id: 'albutts.detail.selected_count',
    defaultMessage:
      '{count, plural, =0 {Tap photos to choose them} other {# selected}}',
  },
  selectAll: {
    id: 'albutts.detail.select_all',
    defaultMessage: 'Select all',
  },
  selectNone: {
    id: 'albutts.detail.select_none',
    defaultMessage: 'Clear',
  },
  downloadSelected: {
    id: 'albutts.detail.download_selected',
    defaultMessage: 'Download',
  },
  doneSelecting: {
    id: 'albutts.detail.done_selecting',
    defaultMessage: 'Done',
  },
  selectPhoto: {
    id: 'albutts.detail.select_photo',
    defaultMessage: 'Select this photo',
  },
  downloadStarted: {
    id: 'albutts.detail.download_started',
    defaultMessage:
      'Putting {count, plural, one {# photo} other {# photos}} into a zip. The download starts when it is ready.',
  },
  downloadTooBig: {
    id: 'albutts.detail.download_too_big',
    defaultMessage:
      'That is more than 1 GB, too much for one download. Use Select photos and download it in parts.',
  },
});

// One download may carry this much. Mirrors `Albutts::AlbumArchive::MAX_BYTES`
// on the server, which is the one that enforces it.
const MAX_DOWNLOAD_BYTES = 1024 ** 3;

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
  const { signedIn } = useIdentity();
  const history = useHistory();
  const [contributeOpen, setContributeOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  // Edit lives in the Ж menu (docs/design.md): the owner gets an Edit
  // album moon that opens the album composer filled in — title,
  // description, reach, who can add, the cover, and Delete album. The
  // photo lightbox registers its own `edit` (the caption) over this one
  // while it's open.
  const startEditing = useCallback(() => {
    setEditing(true);
  }, []);
  const stopEditing = useCallback(() => {
    setEditing(false);
  }, []);
  const handleSaved = useCallback(
    (updated: ApiAlbumJSON) => {
      setEditing(false);
      onChange?.(updated);
    },
    [onChange],
  );
  const handleDeleted = useCallback(() => {
    history.replace('/hub/albutts');
  }, [history]);
  useRegisterPageAction(
    {
      key: 'edit',
      label: intl.formatMessage(messages.editAlbum),
      icon: EditIcon,
      iconId: 'edit',
    },
    startEditing,
    album.is_owner && !editing,
  );

  // Select mode: tapping a photo ticks it, and a bar offers to download the
  // ticked ones. Entered from the album's toolbar, left from the bar.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const toggleSelected = useCallback((photoId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(photoId)) next.add(photoId);
      return next;
    });
  }, []);
  const startSelecting = useCallback(() => {
    setSelecting(true);
  }, []);
  const stopSelecting = useCallback(() => {
    setSelecting(false);
    setSelected(new Set());
  }, []);
  const selectAll = useCallback(() => {
    setSelected(new Set(album.photos.map((p) => p.id)));
  }, [album.photos]);
  const selectNone = useCallback(() => {
    setSelected(new Set());
  }, []);

  // The zip is built by the server and opened as a plain link, so the
  // browser saves it like any other download. `photoIds` null is the whole
  // album.
  const download = useCallback(
    (photoIds: string[] | null) => {
      const photos = photoIds
        ? album.photos.filter((p) => photoIds.includes(p.id))
        : album.photos;
      const bytes = photos.reduce((sum, p) => sum + (p.size ?? 0), 0);
      if (bytes > MAX_DOWNLOAD_BYTES) {
        dispatch(showAlert({ message: messages.downloadTooBig }));
        return;
      }

      const link = document.createElement('a');
      link.href = `/api/v1/albutts/albums/${album.id}/download${
        photoIds ? `?photo_ids=${photoIds.join(',')}` : ''
      }`;
      link.download = '';
      document.body.appendChild(link);
      link.click();
      link.remove();

      dispatch(
        showAlert({
          message: messages.downloadStarted,
          values: { count: photos.length },
        }),
      );
    },
    [album.id, album.photos, dispatch],
  );
  const downloadAlbum = useCallback(() => {
    download(null);
  }, [download]);
  const downloadSelected = useCallback(() => {
    download(album.photos.filter((p) => selected.has(p.id)).map((p) => p.id));
  }, [album.photos, download, selected]);

  const canDownload = signedIn && album.photos.length > 0;

  const openLightbox = useCallback(
    (photoId: string) => {
      dispatch(
        openModal({
          modalType: 'ALBUM_LIGHTBOX',
          modalProps: {
            album,
            initialPhotoId: photoId,
            onAlbumChanged: onChange,
          },
        }),
      );
    },
    [album, dispatch, onChange],
  );

  // Push every photo's backing status into the store so each `PhotoTile`
  // below can drop in `<StatusEngagement showThread={false}>` (the
  // shared reactions bar) without each one paying its own fetch.
  // Album responses already carry `photo.status` inline (avoiding N
  // per-status requests), which is why we can batch here rather than
  // dispatch(fetchStatus(id)) inside each tile.
  useEffect(() => {
    dispatch(importFetchedStatuses(album.photos.map((p) => p.status)));
  }, [dispatch, album.photos]);

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
      {/* Hand-rolled "← Albums" crumb removed 2026-09-03 — the
          Frame's SpaceBadge (top-left "< Albuts") is the standard
          back-to-korner affordance and was rendering above this
          duplicate crumb. Bespoke back links are banned platform-
          wide; see docs/design.md (Aesthetic system) § Navigation. */}

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
            <p className='albutts-detail__description'>
              <CaptionText text={album.description} />
            </p>
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

      {/* Buttons on the page, not moons: the Ж menu is for making and
          editing, and a download is neither (Tal 2026-10-11). */}
      {(album.can_contribute || canDownload) && (
        <div className='albutts-detail__toolbar'>
          {canDownload && !selecting && (
            <>
              <button
                type='button'
                className='albutts-btn albutts-btn--ghost'
                onClick={downloadAlbum}
              >
                <Icon id='download' icon={DownloadIcon} />
                {intl.formatMessage(messages.downloadAlbum)}
              </button>
              <button
                type='button'
                className='albutts-btn albutts-btn--ghost'
                onClick={startSelecting}
              >
                <Icon id='done_all' icon={ChecklistIcon} />
                {intl.formatMessage(messages.selectPhotos)}
              </button>
            </>
          )}
          {album.can_contribute && (
            <button
              type='button'
              className='albutts-btn albutts-btn--primary'
              onClick={openContribute}
            >
              {intl.formatMessage(messages.addPhoto)}
            </button>
          )}
        </div>
      )}

      {album.photos.length === 0 ? (
        <p className='space-subtitle albutts-detail__empty'>
          {intl.formatMessage(messages.emptyPhotos)}
        </p>
      ) : (
        <ul className='albutts-detail__grid'>
          {album.photos.map((p) => (
            <PhotoTile
              key={p.id}
              photo={p}
              onOpen={selecting ? toggleSelected : openLightbox}
              selecting={selecting}
              selected={selected.has(p.id)}
            />
          ))}
        </ul>
      )}

      {selecting && (
        <div className='albutts-select-bar' role='toolbar'>
          <span className='albutts-select-bar__count' aria-live='polite'>
            {intl.formatMessage(messages.selectedCount, {
              count: selected.size,
            })}
          </span>
          <button
            type='button'
            className='albutts-btn albutts-btn--ghost'
            onClick={
              selected.size === album.photos.length ? selectNone : selectAll
            }
          >
            {intl.formatMessage(
              selected.size === album.photos.length
                ? messages.selectNone
                : messages.selectAll,
            )}
          </button>
          <button
            type='button'
            className='albutts-btn albutts-btn--primary'
            onClick={downloadSelected}
            disabled={selected.size === 0}
          >
            {intl.formatMessage(messages.downloadSelected)}
          </button>
          <button
            type='button'
            className='albutts-btn albutts-btn--ghost'
            onClick={stopSelecting}
          >
            {intl.formatMessage(messages.doneSelecting)}
          </button>
        </div>
      )}

      {editing && (
        <AlbumComposer
          album={album}
          onCancel={stopEditing}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
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
  // Opens the photo, or ticks it while selecting.
  onOpen: (photoId: string) => void;
  selecting: boolean;
  selected: boolean;
}> = ({ photo, onOpen, selecting, selected }) => {
  const intl = useIntl();
  const contributor = createAccountFromServerJSON(photo.contributor);
  const name = contributor.display_name || contributor.username;
  const handleClick = useCallback(() => {
    onOpen(photo.id);
  }, [onOpen, photo.id]);

  return (
    <li
      className={classNames('albutts-photo', {
        'albutts-photo--selected': selecting && selected,
      })}
    >
      <button
        type='button'
        className='albutts-photo__trigger'
        onClick={handleClick}
        aria-label={
          selecting
            ? intl.formatMessage(messages.selectPhoto)
            : (photo.caption ?? name)
        }
        aria-pressed={selecting ? selected : undefined}
      >
        {selecting && (
          <span className='albutts-photo__tick' aria-hidden>
            {selected && <Icon id='done' icon={DoneIcon} />}
          </span>
        )}
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
      </div>
      {photo.caption && (
        <div className='albutts-photo__caption'>
          <CaptionText text={photo.caption} />
        </div>
      )}
      {/* Standardised reactions bar — same froth / reply / share
          affordances the feed status carries, so a viewer can react
          to a specific photo from the scroll without opening the
          lightbox (Tal 2026-09-09). `showThread={false}` skips the
          per-tile reply thread + its context fetch — the full thread
          is reachable by tapping the photo. */}
      <StatusEngagement
        statusId={photo.status.id}
        showThread={false}
        className='albutts-photo__engagement'
      />
    </li>
  );
};
