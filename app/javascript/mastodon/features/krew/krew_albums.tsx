import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import { showAlertForError } from 'mastodon/actions/alerts';
import { apiRequestGet } from 'mastodon/api';
import { apiLinkAlbumKrew, apiUnlinkAlbumKrew } from 'mastodon/api/albutts';
import type { ApiAlbumListItemJSON } from 'mastodon/api_types/albutts';
import { useAppDispatch } from 'mastodon/store';

import { KrewLinkPicker } from './krew_link_picker';
import type { LinkChoice } from './krew_link_picker';

// A Krew's albums, on its page when its Albutts tile is open
// (docs/spaces/krew.md, Linking): albums whose audience includes this Krew.
// Making one is the Ж menu's +. A member can link one of their own albums,
// made before or outside the Krew, and unlink it again.

const messages = defineMessages({
  title: { id: 'krew.albums.title', defaultMessage: 'Albums' },
  empty: {
    id: 'krew.albums.empty',
    defaultMessage:
      'No albums in this Krew yet. The + in the Ж menu makes one.',
  },
  link: { id: 'krew.albums.link', defaultMessage: 'Link one of your albums' },
  linkNone: {
    id: 'krew.albums.link_none',
    defaultMessage: 'You have no other albums to link.',
  },
  unlink: { id: 'krew.albums.unlink', defaultMessage: 'Unlink' },
});

type AlbumItem = ApiAlbumListItemJSON;

export const KrewAlbums: React.FC<{ krewId: string; canLink: boolean }> = ({
  krewId,
  canLink,
}) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const [albums, setAlbums] = useState<AlbumItem[] | null>(null);
  const [choices, setChoices] = useState<LinkChoice[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      apiRequestGet<AlbumItem[]>('v1/albutts/albums', {
        krew_id: krewId,
        limit: 60,
      })
        .then((list) => {
          setAlbums(list);
          return list;
        })
        .catch(() => {
          setAlbums([]);
          return [] as AlbumItem[];
        }),
    [krewId],
  );

  useEffect(() => {
    setAlbums(null);
    setChoices(null);
    void load();
  }, [load]);

  const openPicker = useCallback(() => {
    if (choices) {
      setChoices(null);
      return;
    }
    apiRequestGet<AlbumItem[]>('v1/albutts/albums', {
      scope: 'mine',
      limit: 60,
    })
      .then((mine) => {
        const linked = new Set((albums ?? []).map((a) => a.id));
        setChoices(
          mine
            .filter((a) => !linked.has(a.id) && !a.krew_id)
            .map((a) => ({ id: a.id, label: a.title })),
        );
      })
      .catch(() => {
        setChoices([]);
      });
  }, [albums, choices]);

  const link = useCallback(
    (albumId: string) => {
      setBusy(true);
      apiLinkAlbumKrew(albumId, krewId)
        .then(() => load())
        .then(() => {
          setChoices(null);
        })
        .catch((error: unknown) => {
          dispatch(showAlertForError(error));
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [krewId, load, dispatch],
  );

  const unlink = useCallback(
    (albumId: string) => {
      setBusy(true);
      apiUnlinkAlbumKrew(albumId, krewId)
        .then(() => load())
        .catch((error: unknown) => {
          dispatch(showAlertForError(error));
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [krewId, load, dispatch],
  );

  return (
    <section className='krew-detail__section krew-detail__albums'>
      <h3 className='krew-detail__section-heading'>
        {intl.formatMessage(messages.title)}
      </h3>

      {albums?.length === 0 && (
        <p className='krew-detail__section-hint'>
          {intl.formatMessage(messages.empty)}
        </p>
      )}

      {albums && albums.length > 0 && (
        <ul className='krew-detail__event-list'>
          {albums.map((album) => (
            <li key={album.id} className='krew-detail__linked'>
              <Link
                to={`/hub/albutts/albums/${album.id}`}
                className='krew-detail__event'
              >
                <span className='krew-detail__event-title'>{album.title}</span>
                <span className='krew-detail__event-where'>
                  {album.owner.display_name || album.owner.acct}
                </span>
              </Link>
              {album.is_owner && !album.krew_id && (
                <UnlinkButton
                  id={album.id}
                  label={intl.formatMessage(messages.unlink)}
                  disabled={busy}
                  onUnlink={unlink}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {canLink && (
        <>
          <button
            type='button'
            className='krew-detail__link-toggle'
            onClick={openPicker}
            aria-expanded={choices !== null}
          >
            {intl.formatMessage(messages.link)}
          </button>
          <KrewLinkPicker
            choices={choices}
            emptyLabel={intl.formatMessage(messages.linkNone)}
            disabled={busy}
            onPick={link}
          />
        </>
      )}
    </section>
  );
};

export const UnlinkButton: React.FC<{
  id: string;
  label: string;
  disabled: boolean;
  onUnlink: (id: string) => void;
}> = ({ id, label, disabled, onUnlink }) => {
  const handleClick = useCallback(() => {
    onUnlink(id);
  }, [id, onUnlink]);
  return (
    <button
      type='button'
      className='krew-detail__unlink'
      onClick={handleClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
};
