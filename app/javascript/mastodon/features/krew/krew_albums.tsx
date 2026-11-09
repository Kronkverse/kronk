import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiRequestGet } from 'mastodon/api';
import { albumPath } from 'mastodon/api/albutts';
import type { ApiAlbumListItemJSON } from 'mastodon/api_types/albutts';
import { SpaceShelf } from 'mastodon/components/space_shelf';
import type { ShelfCard } from 'mastodon/components/space_shelf';

// A Krew's albums, its Albums section once Albutts is on (docs/spaces/
// krew.md, Linking): albums whose audience includes this Krew, as a row of
// cards. New makes one for the Krew; Add existing links one made elsewhere
// (a Space has New and Add existing, decisions.md 2026-11-08). Taking one
// off is the page's Diskonnect.

const messages = defineMessages({
  title: { id: 'krew.albums.title', defaultMessage: 'Albums' },
});

type AlbumItem = ApiAlbumListItemJSON;

export const KrewAlbums: React.FC<{
  krewId: string;
  id?: string;
  canAdd?: boolean;
}> = ({ krewId, id, canAdd = false }) => {
  const intl = useIntl();
  const [albums, setAlbums] = useState<AlbumItem[] | null>(null);
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

  const reload = useCallback(() => {
    setLoads((n) => n + 1);
  }, []);

  const cards = useMemo<ShelfCard[] | null>(
    () =>
      albums?.map((album) => ({
        key: album.id,
        id: album.id,
        to: albumPath(album),
        image: album.cover_url,
        title: album.title,
        meta: album.owner.display_name || album.owner.acct,
      })) ?? null,
    [albums],
  );

  return (
    <SpaceShelf
      homeSlug='krew'
      homeId={krewId}
      korner='albutts'
      id={id}
      title={intl.formatMessage(messages.title)}
      canAdd={canAdd}
      cards={cards}
      newSearch={`?krew=${krewId}`}
      onAdded={reload}
      className='krew-detail__albums'
    />
  );
};
