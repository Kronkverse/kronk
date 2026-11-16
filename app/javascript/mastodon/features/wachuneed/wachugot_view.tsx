import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import { apiGetMyWachuneedShop } from 'mastodon/api/wachuneed_shops';
import type { ApiShopJSON } from 'mastodon/api/wachuneed_shops';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerPill } from 'mastodon/components/korner_pill';

import { WachuneedRequests } from './requests_view';
import { ShopCards } from './shop_row';
import { MyListings } from './wachuneed_view';

// Mine — your own corner of Wachuneed (Tal, 2026-11-16): your shop as the
// same card the one page shows (it opens the shop, which you change from
// the Ж menu there), or Open a shop until you have one; then the requests
// asked of you and by you (their own section until then); then your own
// listings in every state (live / reserved / closed).

const messages = defineMessages({
  shop: { id: 'wachuneed.mine.shop', defaultMessage: 'My shop' },
  listings: { id: 'wachuneed.mine.listings', defaultMessage: 'My listings' },
  open: { id: 'wachuneed.shop_edit.title_open', defaultMessage: 'Open a shop' },
});

const MyShop: React.FC = () => {
  const intl = useIntl();
  const history = useHistory();
  // undefined while asking, null when you have no shop.
  const [shop, setShop] = useState<ApiShopJSON | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    apiGetMyWachuneedShop()
      .then((data) => {
        if (!cancelled) setShop(data);
        return undefined;
      })
      .catch(() => {
        // Left unknown; Mine shows the rest without it.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpen = useCallback(() => {
    history.push('/hub/wachuneed/my-shop');
  }, [history]);

  if (shop === undefined) return null;

  if (shop === null) {
    return (
      <KornerActionBar>
        <KornerPill
          label={intl.formatMessage(messages.open)}
          onClick={handleOpen}
        />
      </KornerActionBar>
    );
  }

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
    <WachuneedRequests />
    <MyListings />
  </>
);
