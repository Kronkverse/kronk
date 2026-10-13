import { defineMessages, useIntl } from 'react-intl';

import type { ApiShopJSON } from 'mastodon/api/wachuneed_shops';
import { SpaceCard } from 'mastodon/components/space_grid';

// One shop as a tile of the standard grid (`<SpaceCard>`), wherever shops
// are listed: the Shops section, the top of Offered, and your own at the
// top of Mine. The image is the shop's own picture; a shop without one
// shows the cover of its newest item, and failing that the seller's avatar.

const messages = defineMessages({
  count: {
    id: 'wachuneed.shops.count',
    defaultMessage: '{count, plural, one {# listing} other {# listings}}',
  },
});

export const ShopCard: React.FC<{ shop: ApiShopJSON }> = ({ shop }) => {
  const intl = useIntl();

  return (
    <SpaceCard
      to={`/hub/wachuneed/shop/${shop.account.acct}`}
      image={
        shop.picture_url ??
        shop.preview_photos?.[0] ??
        shop.account.avatar_static
      }
      title={shop.name}
      meta={intl.formatMessage(messages.count, {
        count: shop.listings_count,
      })}
      tag={shop.based_in}
    />
  );
};
