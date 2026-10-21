import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import {
  apiGetMyWachuneedShop,
  apiGetWachuneedShops,
} from 'mastodon/api/wachuneed_shops';
import type { ApiShopJSON } from 'mastodon/api/wachuneed_shops';
import { EmptyState } from 'mastodon/components/empty_state';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LoadingState } from 'mastodon/components/loading_state';
import { SpaceGrid } from 'mastodon/components/space_grid';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';
import { me } from 'mastodon/initial_state';

import { ShopCard } from './shop_card';

// /hub/wachuneed/shops — every shop with something on offer, your Mates'
// first and then the oldest (the server sets the order), as tiles in the
// standard grid (`<SpaceGrid>`, one `<ShopCard>` each). Until you have a
// shop of your own, + on the Ж menu here is Open a shop.

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
  const [hasShop, setHasShop] = useState(true);

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

  useEffect(() => {
    if (!me) return;
    let cancelled = false;

    apiGetMyWachuneedShop()
      .then((data) => {
        if (!cancelled) setHasShop(!!data);
        return undefined;
      })
      .catch(() => {
        // Left as having one; + stays New listing.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpen = useCallback(() => {
    history.push('/hub/wachuneed/my-shop');
  }, [history]);
  useRegisterPageAction(
    {
      key: 'post',
      label: intl.formatMessage(messages.open),
      icon: AddIcon,
      iconId: 'add',
    },
    handleOpen,
    !hasShop,
  );

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
        <ShopCard key={shop.id} shop={shop} />
      ))}
    </SpaceGrid>
  );
};
