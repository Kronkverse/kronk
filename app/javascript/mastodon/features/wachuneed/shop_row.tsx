import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import { apiGetWachuneedShops } from 'mastodon/api/wachuneed_shops';
import type { ApiShopJSON } from 'mastodon/api/wachuneed_shops';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerPill } from 'mastodon/components/korner_pill';
import { SpaceGrid } from 'mastodon/components/space_grid';

import { ShopCard } from './shop_card';

// Shops above a section's listings, as cards in the standard grid: on
// Offered the first few (your Mates' first; the server sets the order)
// and the way to the rest, on Mine your own. `below` names the listings
// that follow, so the two grids read as two things.

const messages = defineMessages({
  heading: { id: 'wachuneed.shops.heading', defaultMessage: 'Shops' },
  listings: { id: 'wachuneed.shops.listings', defaultMessage: 'Listings' },
  all: {
    id: 'wachuneed.shops.all',
    defaultMessage: 'All shops ({count})',
  },
});

// One row of the grid on a desktop, two on a phone.
const SHOWN = 4;

export const ShopCards: React.FC<{
  shops: ApiShopJSON[];
  heading: string;
  below: string;
  // How many shops there are when not all of them are shown.
  total?: number;
}> = ({ shops, heading, below, total }) => {
  const intl = useIntl();
  const history = useHistory();
  const handleAll = useCallback(() => {
    history.push('/hub/wachuneed/shops');
  }, [history]);

  return (
    <>
      <section className='wachuneed-shops' aria-label={heading}>
        <h2 className='wachuneed-shops__heading'>{heading}</h2>
        <SpaceGrid>
          {shops.map((shop) => (
            <ShopCard key={shop.id} shop={shop} />
          ))}
        </SpaceGrid>
        {total !== undefined && total > shops.length ? (
          <KornerActionBar>
            <KornerPill
              label={intl.formatMessage(messages.all, { count: total })}
              onClick={handleAll}
            />
          </KornerActionBar>
        ) : null}
      </section>
      <h2 className='wachuneed-shops__heading'>{below}</h2>
    </>
  );
};

export const ShopRow: React.FC = () => {
  const intl = useIntl();
  const [shops, setShops] = useState<ApiShopJSON[]>([]);

  useEffect(() => {
    let cancelled = false;

    apiGetWachuneedShops()
      .then((data) => {
        if (!cancelled) setShops(data);
        return undefined;
      })
      .catch(() => {
        // No shops shown; the listings below are unaffected.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Nothing is drawn while there are no shops, so Offered looks as it did
  // until someone opens one.
  if (shops.length === 0) return null;

  return (
    <ShopCards
      shops={shops.slice(0, SHOWN)}
      total={shops.length}
      heading={intl.formatMessage(messages.heading)}
      below={intl.formatMessage(messages.listings)}
    />
  );
};
