import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import { apiGetWachugotListings } from 'mastodon/api/wachuneed';
import { apiGetMyWachuneedShop } from 'mastodon/api/wachuneed_shops';
import type { ApiShopJSON } from 'mastodon/api/wachuneed_shops';
import { KornerPill } from 'mastodon/components/korner_pill';

import { ShopCards } from './shop_row';
import { WachuneedListings } from './wachuneed_view';

// Mine — the caller's own listings, across every state (live /
// reserved / closed). Reuses the shared WachuneedListings surface;
// only the loader differs. Above them, your shop as the same card Offered
// shows (it opens the shop, which you change from the Ж menu there), or
// the way to open one.

const messages = defineMessages({
  open: { id: 'wachuneed.shop_edit.title_open', defaultMessage: 'Open a shop' },
  shop: { id: 'wachuneed.mine.shop', defaultMessage: 'My shop' },
  listings: { id: 'wachuneed.mine.listings', defaultMessage: 'My listings' },
});

const MyShop: React.FC = () => {
  const intl = useIntl();
  const history = useHistory();
  // undefined while asking; null when you have no shop.
  const [shop, setShop] = useState<ApiShopJSON | null | undefined>();

  useEffect(() => {
    let cancelled = false;

    apiGetMyWachuneedShop()
      .then((data) => {
        if (!cancelled) setShop(data);
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setShop(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpen = useCallback(() => {
    history.push('/hub/wachuneed/my-shop');
  }, [history]);

  if (shop === undefined) return null;

  if (shop) {
    return (
      <ShopCards
        shops={[shop]}
        heading={intl.formatMessage(messages.shop)}
        below={intl.formatMessage(messages.listings)}
      />
    );
  }

  return (
    <div className='wachuneed__section-action'>
      <KornerPill
        label={intl.formatMessage(messages.open)}
        onClick={handleOpen}
      />
    </div>
  );
};

export const WachugotListings: React.FC = () => (
  <>
    <MyShop />
    <WachuneedListings loader={apiGetWachugotListings} scope='mine' />
  </>
);
