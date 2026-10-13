import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import { apiGetWachuneedShops } from 'mastodon/api/wachuneed_shops';
import type { ApiShopJSON } from 'mastodon/api/wachuneed_shops';
import { EmptyState } from 'mastodon/components/empty_state';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LoadingState } from 'mastodon/components/loading_state';
import { SpaceCard, SpaceGrid } from 'mastodon/components/space_grid';

// /hub/wachuneed/shops — every shop with something on offer, your Mates'
// first and then the oldest (the server sets the order), as tiles in the
// standard grid (`<SpaceGrid>`): the cover of the shop's newest item (its
// own picture when it has no photos yet), its name, and how much is in it.

const messages = defineMessages({
  loading: { id: 'wachuneed.shops.loading', defaultMessage: 'Loading shops…' },
  empty: { id: 'wachuneed.shops.empty', defaultMessage: 'No shops open yet' },
  emptyBody: {
    id: 'wachuneed.shops.empty.body',
    defaultMessage:
      'A shop is a page of your own for what you make or sell, in sections you name.',
  },
  open: { id: 'wachuneed.shop_edit.title_open', defaultMessage: 'Open a shop' },
  count: {
    id: 'wachuneed.shops.count',
    defaultMessage: '{count, plural, one {# listing} other {# listings}}',
  },
});

export const WachuneedShops: React.FC = () => {
  const intl = useIntl();
  const history = useHistory();
  const [shops, setShops] = useState<ApiShopJSON[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    apiGetWachuneedShops()
      .then((data) => {
        if (!cancelled) setShops(data);
        return undefined;
      })
      .catch(() => {
        // Left empty; the page says there are none.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpen = useCallback(() => {
    history.push('/hub/wachuneed/my-shop');
  }, [history]);

  if (loading) {
    return <LoadingState label={intl.formatMessage(messages.loading)} />;
  }

  if (shops.length === 0) {
    return (
      <EmptyState
        title={intl.formatMessage(messages.empty)}
        body={intl.formatMessage(messages.emptyBody)}
        action={
          <KornerPill
            label={intl.formatMessage(messages.open)}
            variant='primary'
            onClick={handleOpen}
          />
        }
      />
    );
  }

  return (
    <SpaceGrid>
      {shops.map((shop) => (
        <SpaceCard
          key={shop.id}
          to={`/hub/wachuneed/shop/${shop.account.acct}`}
          image={
            shop.preview_photos?.[0] ??
            shop.picture_url ??
            shop.account.avatar_static
          }
          title={shop.name}
          meta={intl.formatMessage(messages.count, {
            count: shop.listings_count,
          })}
          tag={shop.based_in}
        />
      ))}
    </SpaceGrid>
  );
};
