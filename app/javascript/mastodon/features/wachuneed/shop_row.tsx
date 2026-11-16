import type { ApiShopJSON } from 'mastodon/api/wachuneed_shops';
import { SpaceGrid } from 'mastodon/components/space_grid';

import { ShopCard } from './shop_card';

// Your shop above your listings on Mine, as a card in the standard grid.
// `below` names the listings that follow, so the two grids read as two
// things.

export const ShopCards: React.FC<{
  shops: ApiShopJSON[];
  heading: string;
  below: string;
}> = ({ shops, heading, below }) => (
  <>
    <section className='wachuneed-shops' aria-label={heading}>
      <h2 className='wachuneed-shops__heading'>{heading}</h2>
      <SpaceGrid>
        {shops.map((shop) => (
          <ShopCard key={shop.id} shop={shop} />
        ))}
      </SpaceGrid>
    </section>
    <h2 className='wachuneed-shops__heading'>{below}</h2>
  </>
);
