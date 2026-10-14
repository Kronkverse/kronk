import { useEffect, useState } from 'react';

import { FormattedMessage } from 'react-intl';

import { Link } from 'react-router-dom';

import { apiGetProfileShop } from 'mastodon/api/wachuneed_shops';

// The way from a profile to its owner's Wachuneed shop, in the header of
// their Wachuneed shelf (Tal 2026-10-14: with the other spaces, not under
// the profile header). Drawn only when they have a shop and chose to show
// it (docs/spaces/wachuneed.md, Shops); the server answers null otherwise,
// and nothing takes its place.
export const ProfileShopLink: React.FC<{ accountId: string }> = ({
  accountId,
}) => {
  const [shop, setShop] = useState<{ name: string; acct: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setShop(null);

    apiGetProfileShop(accountId)
      .then((data) => {
        if (!cancelled) setShop(data.shop);
        return undefined;
      })
      .catch(() => {
        // No line.
      });

    return () => {
      cancelled = true;
    };
  }, [accountId]);

  if (!shop) return null;

  return (
    <Link
      to={`/hub/wachuneed/shop/${shop.acct}`}
      className='profile-shelves__shelf-shop'
    >
      <FormattedMessage
        id='profile.shop'
        defaultMessage='Shop: {name}'
        values={{ name: shop.name }}
      />
    </Link>
  );
};
