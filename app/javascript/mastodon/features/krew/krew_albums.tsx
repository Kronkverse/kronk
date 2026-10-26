import { useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import { apiRequestGet } from 'mastodon/api';
import { albumPath } from 'mastodon/api/albutts';
import type { ApiAlbumListItemJSON } from 'mastodon/api_types/albutts';

// A Krew's albums, on its page when its Albutts tile is open
// (docs/spaces/krew.md, Linking): albums whose audience includes this Krew.
// Making one is the Ж menu's +. Linking one made elsewhere, and taking it
// off again, is the page's Konnect and Diskonnect (decisions.md,
// 2026-10-27), not this list.

const messages = defineMessages({
  title: { id: 'krew.albums.title', defaultMessage: 'Albums' },
  empty: {
    id: 'krew.albums.empty',
    defaultMessage:
      'No albums in this Krew yet. The + in the Ж menu makes one.',
  },
});

type AlbumItem = ApiAlbumListItemJSON;

export const KrewAlbums: React.FC<{
  krewId: string;
}> = ({ krewId }) => {
  const intl = useIntl();
  const [albums, setAlbums] = useState<AlbumItem[] | null>(null);

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
  }, [krewId]);

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
    </section>
  );
};
