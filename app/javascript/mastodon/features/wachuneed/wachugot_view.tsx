import { useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiGetWachugotListings } from 'mastodon/api/wachuneed';
import { apiGetMyWachuneedShop } from 'mastodon/api/wachuneed_shops';
import type { ApiShopJSON } from 'mastodon/api/wachuneed_shops';

import { ShopCards } from './shop_row';
import { WachuneedListings } from './wachuneed_view';

// Mine — the caller's own listings, across every state (live /
// reserved / closed). Reuses the shared WachuneedListings surface;
// only the loader differs. Above them, your shop as the same card Offered
// shows (it opens the shop, which you change from the Ж menu there). With
// no shop there is nothing here: Shops is where you open one.

const messages = defineMessages({
  shop: { id: 'wachuneed.mine.shop', defaultMessage: 'My shop' },
  listings: { id: 'wachuneed.mine.listings', defaultMessage: 'My listings' },
});

const MyShop: React.FC = () => {
  const intl = useIntl();
  // null while asking, and when you have no shop.
  const [shop, setShop] = useState<ApiShopJSON | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiGetMyWachuneedShop()
      .then((data) => {
        if (!cancelled) setShop(data);
        return undefined;
      })
      .catch(() => {
        // Left empty; Mine shows your listings alone.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!shop) return null;

  return (
    <ShopCards
      shops={[shop]}
      heading={intl.formatMessage(messages.shop)}
      below={intl.formatMessage(messages.listings)}
    />
  );
};

export const WachugotListings: React.FC = () => (
  <>
    <MyShop />
    <WachuneedListings loader={apiGetWachugotListings} scope='mine' />
  </>
);
