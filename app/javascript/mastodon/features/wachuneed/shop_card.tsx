import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import type { ApiShopJSON } from 'mastodon/api/wachuneed_shops';

// One shop as a card: a strip of what is in it, then whose it is. The
// Shops section draws it in full; Offered uses the `compact` line (picture,
// name, count) so the listings below stay the point of that page.

const messages = defineMessages({
  count: {
    id: 'wachuneed.shops.count',
    defaultMessage: '{count, plural, one {# listing} other {# listings}}',
  },
  by: { id: 'wachuneed.shop.by', defaultMessage: 'by {name}' },
  byIn: { id: 'wachuneed.shop.by_in', defaultMessage: 'by {name}, {place}' },
});

// How many photos fit across a card.
const STRIP = 3;

export const ShopCard: React.FC<{ shop: ApiShopJSON; compact?: boolean }> = ({
  shop,
  compact = false,
}) => {
  const intl = useIntl();
  const owner = shop.account.display_name || `@${shop.account.acct}`;
  const picture = shop.picture_url ?? shop.account.avatar_static;
  const count = intl.formatMessage(messages.count, {
    count: shop.listings_count,
  });
  const to = `/hub/wachuneed/shop/${shop.account.acct}`;

  if (compact) {
    return (
      <Link
        to={to}
        className='wachuneed-shop-card wachuneed-shop-card--compact'
      >
        <img src={picture} alt='' className='wachuneed-shop-card__picture' />
        <span className='wachuneed-shop-card__text'>
          <span className='wachuneed-shop-card__name'>{shop.name}</span>
          <span className='wachuneed-shop-card__count'>{count}</span>
        </span>
      </Link>
    );
  }

  const photos = (shop.preview_photos ?? []).slice(0, STRIP);

  return (
    <Link to={to} className='wachuneed-shop-card'>
      <span
        className={`wachuneed-shop-card__strip wachuneed-shop-card__strip--${photos.length}`}
        aria-hidden='true'
      >
        {photos.map((url) => (
          <img key={url} src={url} alt='' />
        ))}
      </span>
      <span className='wachuneed-shop-card__body'>
        <img src={picture} alt='' className='wachuneed-shop-card__picture' />
        <span className='wachuneed-shop-card__text'>
          <span className='wachuneed-shop-card__name'>{shop.name}</span>
          <span className='wachuneed-shop-card__owner'>
            {shop.based_in
              ? intl.formatMessage(messages.byIn, {
                  name: owner,
                  place: shop.based_in,
                })
              : intl.formatMessage(messages.by, { name: owner })}
          </span>
        </span>
      </span>
      {shop.description ? (
        <span className='wachuneed-shop-card__line'>{shop.description}</span>
      ) : null}
      <span className='wachuneed-shop-card__count'>{count}</span>
    </Link>
  );
};
