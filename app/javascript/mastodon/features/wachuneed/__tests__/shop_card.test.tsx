import { render, screen } from '@/testing/rendering';
import type { ApiShopJSON } from 'mastodon/api/wachuneed_shops';

import { ShopCard } from '../shop_card';

const shop: ApiShopJSON = {
  id: '1',
  name: 'Ana Aromas',
  description: 'Small batch',
  listings_count: 9,
  enquiries: 'mates',
  show_on_profile: false,
  based_in: 'Bellingen',
  preview_photos: ['/a.png', '/b.png', '/c.png', '/d.png'],
  account: {
    id: '7',
    acct: 'ana',
    display_name: 'Ana',
    avatar: '/ana.png',
    avatar_static: '/ana.png',
  },
};

describe('ShopCard', () => {
  it('shows what is in the shop and whose it is, and leads to it', () => {
    const { container } = render(<ShopCard shop={shop} />);

    expect(screen.getByRole('link').getAttribute('href')).toBe(
      '/hub/wachuneed/shop/ana',
    );
    expect(screen.queryByText('Ana Aromas')).not.toBeNull();
    expect(screen.queryByText('by Ana, Bellingen')).not.toBeNull();
    expect(screen.queryByText('Small batch')).not.toBeNull();
    expect(screen.queryByText('9 listings')).not.toBeNull();
    // Three across, however many the shop has.
    expect(
      container.querySelectorAll('.wachuneed-shop-card__strip img'),
    ).toHaveLength(3);
  });

  it('keeps its shape for a shop with no photos, and for an older server', () => {
    const { container } = render(
      <ShopCard shop={{ ...shop, preview_photos: undefined }} />,
    );

    expect(
      container.querySelector('.wachuneed-shop-card__strip--0'),
    ).not.toBeNull();
  });

  it('is one line when compact: picture, name and count', () => {
    const { container } = render(<ShopCard shop={shop} compact />);

    expect(screen.queryByText('Ana Aromas')).not.toBeNull();
    expect(screen.queryByText('9 listings')).not.toBeNull();
    expect(screen.queryByText('Small batch')).toBeNull();
    expect(container.querySelector('.wachuneed-shop-card__strip')).toBeNull();
  });
});
