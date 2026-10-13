import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import { apiGetWachuneedShops } from 'mastodon/api/wachuneed_shops';
import type { ApiShopJSON } from 'mastodon/api/wachuneed_shops';
import { EmptyState } from 'mastodon/components/empty_state';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LoadingState } from 'mastodon/components/loading_state';

import { ShopCard } from './shop_card';

// /hub/wachuneed/shops — every shop with something on offer, your Mates'
// first and then the oldest (the server sets the order). A shop is a
// seller's own page; this is the street they are on.

const messages = defineMessages({
  loading: { id: 'wachuneed.shops.loading', defaultMessage: 'Loading shops…' },
  empty: { id: 'wachuneed.shops.empty', defaultMessage: 'No shops open yet' },
  emptyBody: {
    id: 'wachuneed.shops.empty.body',
    defaultMessage:
      'A shop is a page of your own for what you make or sell, in sections you name.',
  },
  open: { id: 'wachuneed.shop_edit.title_open', defaultMessage: 'Open a shop' },
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
    <ul className='wachuneed-shops__grid'>
      {shops.map((shop) => (
        <li key={shop.id}>
          <ShopCard shop={shop} />
        </li>
      ))}
    </ul>
  );
};
