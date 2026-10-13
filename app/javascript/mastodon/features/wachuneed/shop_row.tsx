import { useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import { apiGetWachuneedShops } from 'mastodon/api/wachuneed_shops';
import type { ApiShopJSON } from 'mastodon/api/wachuneed_shops';

// The row of shops across the top of Offered (Tal 2026-10-12): one card
// per seller who has opened a shop and has something on offer, scrolling
// sideways, your Mates' shops first and then the oldest. The server sets
// the order. Nothing is drawn while there are no shops, so Offered looks
// as it did until someone opens one.

const messages = defineMessages({
  heading: { id: 'wachuneed.shops.heading', defaultMessage: 'Shops' },
  count: {
    id: 'wachuneed.shops.count',
    defaultMessage: '{count, plural, one {# listing} other {# listings}}',
  },
});

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
        // No row; the listings below are unaffected.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (shops.length === 0) return null;

  const heading = intl.formatMessage(messages.heading);

  return (
    <section className='wachuneed-shops' aria-label={heading}>
      <h2 className='wachuneed-shops__heading'>{heading}</h2>
      <ul className='wachuneed-shops__row'>
        {shops.map((shop) => (
          <li key={shop.id} className='wachuneed-shops__cell'>
            <Link
              to={`/hub/wachuneed/shop/${shop.account.acct}`}
              className='wachuneed-shops__card'
            >
              <img
                src={shop.picture_url ?? shop.account.avatar_static}
                alt=''
                className='wachuneed-shops__picture'
              />
              <span className='wachuneed-shops__name'>{shop.name}</span>
              <span className='wachuneed-shops__count'>
                {intl.formatMessage(messages.count, {
                  count: shop.listings_count,
                })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};
