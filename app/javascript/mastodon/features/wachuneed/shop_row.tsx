import { useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import { apiGetWachuneedShops } from 'mastodon/api/wachuneed_shops';
import type { ApiShopJSON } from 'mastodon/api/wachuneed_shops';

import { ShopCard } from './shop_card';

// Shops at the top of Offered: the first few as one-line cards, your
// Mates' first (the server sets the order), and the way to the rest. It
// wraps rather than scrolling sideways. Nothing is drawn while there are
// no shops, so Offered looks as it did until someone opens one.

const messages = defineMessages({
  heading: { id: 'wachuneed.shops.heading', defaultMessage: 'Shops' },
  all: {
    id: 'wachuneed.shops.all',
    defaultMessage: 'All shops ({count})',
  },
});

// Two rows of two on a phone, one row of four from tablet width.
const SHOWN = 4;

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

  if (shops.length === 0) return null;

  const heading = intl.formatMessage(messages.heading);

  return (
    <section className='wachuneed-shops' aria-label={heading}>
      <div className='wachuneed-shops__head'>
        <h2 className='wachuneed-shops__heading'>{heading}</h2>
        <Link to='/hub/wachuneed/shops' className='wachuneed-shops__all'>
          {intl.formatMessage(messages.all, { count: shops.length })}
        </Link>
      </div>
      <ul className='wachuneed-shops__row'>
        {shops.slice(0, SHOWN).map((shop) => (
          <li key={shop.id}>
            <ShopCard shop={shop} compact />
          </li>
        ))}
      </ul>
    </section>
  );
};
