import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import { apiGetWachuneedShops } from 'mastodon/api/wachuneed_shops';
import type { ApiShopJSON } from 'mastodon/api/wachuneed_shops';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerPill } from 'mastodon/components/korner_pill';

// Shops at the top of Offered: the first few by name, your Mates' first
// (the server sets the order), and the way to the rest, as pills in the
// standard action bar. It wraps rather than scrolling sideways. Nothing
// is drawn while there are no shops, so Offered looks as it did until
// someone opens one.

const messages = defineMessages({
  heading: { id: 'wachuneed.shops.heading', defaultMessage: 'Shops' },
  all: {
    id: 'wachuneed.shops.all',
    defaultMessage: 'All shops ({count})',
  },
});

const SHOWN = 4;

const ShopPill: React.FC<{ shop: ApiShopJSON }> = ({ shop }) => {
  const history = useHistory();
  const acct = shop.account.acct;
  const handleClick = useCallback(() => {
    history.push(`/hub/wachuneed/shop/${acct}`);
  }, [history, acct]);

  return <KornerPill label={shop.name} onClick={handleClick} />;
};

export const ShopRow: React.FC = () => {
  const intl = useIntl();
  const history = useHistory();
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

  const handleAll = useCallback(() => {
    history.push('/hub/wachuneed/shops');
  }, [history]);

  if (shops.length === 0) return null;

  const heading = intl.formatMessage(messages.heading);

  return (
    <section className='wachuneed-shops' aria-label={heading}>
      <h2 className='wachuneed-shops__heading'>{heading}</h2>
      <KornerActionBar>
        {shops.slice(0, SHOWN).map((shop) => (
          <ShopPill key={shop.id} shop={shop} />
        ))}
        {shops.length > SHOWN ? (
          <KornerPill
            label={intl.formatMessage(messages.all, { count: shops.length })}
            onClick={handleAll}
          />
        ) : null}
      </KornerActionBar>
    </section>
  );
};
