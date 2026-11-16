import { defineMessages, useIntl } from 'react-intl';

import type { ApiShopJSON } from 'mastodon/api/wachuneed_shops';
import { SpaceCard } from 'mastodon/components/space_grid';

// One shop as a tile of the standard grid (`<SpaceCard>`), wherever shops
// are listed: the row at the top of Wachuneed and your own on Mine. A shop is
// a different kind of thing from the listings around it, so its card says so
// (Tal, 2026-11-16): Kronk purple, wide (in a `<SpaceGrid wide>`), a SHOP tag,
// several pictures (its own, then the covers of its newest items) and the
// seller's face. A shop with no pictures at all shows the seller's avatar.

const messages = defineMessages({
  count: {
    id: 'wachuneed.shops.count',
    defaultMessage: '{count, plural, one {# listing} other {# listings}}',
  },
  placeCount: {
    id: 'wachuneed.shops.place_count',
    defaultMessage:
      '{place} · {count, plural, one {# listing} other {# listings}}',
  },
  shop: { id: 'wachuneed.card.shop', defaultMessage: 'Shop' },
});

export const ShopCard: React.FC<{ shop: ApiShopJSON }> = ({ shop }) => {
  const intl = useIntl();
  const pictures = [shop.picture_url, ...(shop.preview_photos ?? [])].filter(
    (src): src is string => !!src,
  );
  const count = shop.listings_count;

  return (
    <SpaceCard
      to={`/hub/wachuneed/shop/${shop.account.acct}`}
      tone='accent'
      images={pictures}
      image={shop.account.avatar_static}
      avatar={pictures.length > 0 ? shop.account.avatar_static : null}
      title={shop.name}
      meta={
        shop.based_in
          ? intl.formatMessage(messages.placeCount, {
              place: shop.based_in,
              count,
            })
          : intl.formatMessage(messages.count, { count })
      }
      tag={intl.formatMessage(messages.shop)}
      tagKind='shop'
    />
  );
};
