import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import type { ApiShopJSON } from 'mastodon/api/wachuneed_shops';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerPill } from 'mastodon/components/korner_pill';
import { SpaceGrid } from 'mastodon/components/space_grid';

import { ShopCard } from './shop_card';

// Shops above a section's listings, as cards in the standard grid: on
// Mine your own. `below` names the listings that follow, so the two grids
// read as two things. (Offered opened with the first four shops until
// 2026-10-29, when the landing gained a Shops row; home_view.tsx.)

const messages = defineMessages({
  all: {
    id: 'wachuneed.shops.all',
    defaultMessage: 'All shops ({count})',
  },
});

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
