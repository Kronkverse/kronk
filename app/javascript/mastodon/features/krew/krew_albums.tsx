import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link, useHistory } from 'react-router-dom';

import { apiRequestGet } from 'mastodon/api';
import { albumPath } from 'mastodon/api/albutts';
import type { ApiAlbumListItemJSON } from 'mastodon/api_types/albutts';
import { AttachmentPicker } from 'mastodon/components/attachment_picker';

// A Krew's albums, on its page when its Albutts tile is open
// (docs/spaces/krew.md, Linking): albums whose audience includes this Krew.
// New makes one for the Krew; Add existing links one made elsewhere (a
// Space has New and Add existing, decisions.md 2026-11-08). Taking one off
// is the page's Diskonnect.

const messages = defineMessages({
  title: { id: 'krew.albums.title', defaultMessage: 'Albums' },
  empty: {
    id: 'krew.albums.empty',
    defaultMessage: 'No albums in this Krew yet.',
  },
  newAlbum: { id: 'space_shelf.new', defaultMessage: 'New' },
  addExisting: {
    id: 'space_shelf.add_existing',
    defaultMessage: 'Add existing',
  },
});

type AlbumItem = ApiAlbumListItemJSON;

export const KrewAlbums: React.FC<{
  krewId: string;
  canAdd?: boolean;
}> = ({ krewId, canAdd = false }) => {
  const intl = useIntl();
  const history = useHistory();
  const [albums, setAlbums] = useState<AlbumItem[] | null>(null);
  const [picking, setPicking] = useState(false);
  const [loads, setLoads] = useState(0);

  useEffect(() => {
    setAlbums(null);
    apiRequestGet<AlbumItem[]>('v1/albutts/albums', {
      krew_id: krewId,
      limit: 60,
    })
      .then(setAlbums)
      .catch(() => {
        setAlbums([]);
      });
  }, [krewId, loads]);

  const handleNew = useCallback(() => {
    history.push({
      pathname: '/hub/albutts/composer',
      search: `?krew=${krewId}`,
    });
  }, [history, krewId]);
  const openPicker = useCallback(() => {
    setPicking(true);
  }, []);
  const closePicker = useCallback(() => {
    setPicking(false);
  }, []);
  const reload = useCallback(() => {
    setLoads((n) => n + 1);
  }, []);

  return (
    <section className='krew-detail__section krew-detail__albums'>
      <h3 className='korner-section-heading'>
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
            <li key={album.id}>
              <Link to={albumPath(album)} className='krew-detail__event'>
                <span className='krew-detail__event-title'>{album.title}</span>
                <span className='krew-detail__event-where'>
                  {album.owner.display_name || album.owner.acct}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {canAdd && (
        <div className='space-shelf__actions'>
          <button type='button' className='button' onClick={handleNew}>
            {intl.formatMessage(messages.newAlbum)}
          </button>
          <button
            type='button'
            className='button button-secondary'
            onClick={openPicker}
          >
            {intl.formatMessage(messages.addExisting)}
          </button>
        </div>
      )}

      {picking && (
        <AttachmentPicker
          sourceSlug='krew'
          sourceId={krewId}
          onlySlug='albutts'
          onClose={closePicker}
          onAttached={reload}
          exclude={(albums ?? []).map((a) => ({ slug: 'albutts', id: a.id }))}
        />
      )}
    </section>
  );
};
