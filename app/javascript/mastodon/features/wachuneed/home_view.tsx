import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link, useHistory } from 'react-router-dom';

import {
  apiGetWachumissingListings,
  apiGetWachuneedListings,
} from 'mastodon/api/wachuneed';
import { apiGetWachuneedShops } from 'mastodon/api/wachuneed_shops';
import type { ApiShopJSON } from 'mastodon/api/wachuneed_shops';
import type { ApiListingJSON } from 'mastodon/api_types/wachuneed';
import { EmptyState } from 'mastodon/components/empty_state';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LoadingState } from 'mastodon/components/loading_state';
import { SpaceGrid } from 'mastodon/components/space_grid';

import { ListingCard } from './listing_card';
import { ShopCard } from './shop_card';

// /hub/wachuneed — the landing (Kommons "Home Page", Tal, 2026-10-29): one
// page that scrolls down, with a row that scrolls sideways for each of
// Offered, Desired and Shops, newest first (shops in the server's order,
// your Mates' first). Each row's See all opens that section's full view.
// A row with nothing in it is left out; with nothing anywhere, the page
// says so and offers List something.

const messages = defineMessages({
  loading: { id: 'wachuneed.loading', defaultMessage: 'Loading listings…' },
  offered: { id: 'wachuneed.home.offered', defaultMessage: 'Offered' },
  desired: { id: 'wachuneed.home.desired', defaultMessage: 'Desired' },
  shops: { id: 'wachuneed.home.shops', defaultMessage: 'Shops' },
  seeAll: { id: 'wachuneed.home.see_all', defaultMessage: 'See all' },
  seeAllOf: {
    id: 'wachuneed.home.see_all_of',
    defaultMessage: 'See all {section}',
  },
  empty: { id: 'wachuneed.empty', defaultMessage: 'Nothing on offer yet' },
  emptyBody: {
    id: 'wachuneed.empty.body',
    defaultMessage:
      'Art, stuff and offerings from the community show up here. Be the first to list something.',
  },
  listSomething: {
    id: 'wachuneed.list_something',
    defaultMessage: 'List something',
  },
});

// How many tiles a row shows before See all.
const ROW_SIZE = 12;

const HomeRow: React.FC<{
  title: string;
  to: string;
  children: React.ReactNode;
}> = ({ title, to, children }) => {
  const intl = useIntl();

  return (
    <section className='wachuneed-home__row' aria-label={title}>
      <div className='wachuneed-home__head'>
        <h2 className='korner-section-heading'>{title}</h2>
        <Link
          className='wachuneed-home__all'
          to={to}
          aria-label={intl.formatMessage(messages.seeAllOf, {
            section: title,
          })}
        >
          {intl.formatMessage(messages.seeAll)}
        </Link>
      </div>
      <SpaceGrid layout='row'>{children}</SpaceGrid>
    </section>
  );
};

interface HomeData {
  offered: ApiListingJSON[];
  desired: ApiListingJSON[];
  shops: ApiShopJSON[];
}

// A row that fails to load is left out; the others still show.
const settled = <T,>(result: PromiseSettledResult<T[]>): T[] =>
  result.status === 'fulfilled' ? result.value.slice(0, ROW_SIZE) : [];

export const WachuneedHome: React.FC = () => {
  const intl = useIntl();
  const history = useHistory();
  const [data, setData] = useState<HomeData | null>(null);

  useEffect(() => {
    let cancelled = false;

    void Promise.allSettled([
      apiGetWachuneedListings(),
      apiGetWachumissingListings(),
      apiGetWachuneedShops(),
    ]).then(([offered, desired, shops]) => {
      if (!cancelled) {
        setData({
          offered: settled(offered),
          desired: settled(desired),
          shops: settled(shops),
        });
      }
      return undefined;
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleNew = useCallback(() => {
    history.push('/hub/wachuneed/new');
  }, [history]);

  if (!data) {
    return <LoadingState label={intl.formatMessage(messages.loading)} />;
  }

  const { offered, desired, shops } = data;

  if (offered.length + desired.length + shops.length === 0) {
    return (
      <EmptyState
        title={intl.formatMessage(messages.empty)}
        body={intl.formatMessage(messages.emptyBody)}
        action={
          <KornerPill
            label={intl.formatMessage(messages.listSomething)}
            variant='primary'
            onClick={handleNew}
          />
        }
      />
    );
  }

  return (
    <div className='wachuneed-home'>
      {offered.length > 0 && (
        <HomeRow
          title={intl.formatMessage(messages.offered)}
          to='/hub/wachuneed/offered'
        >
          {offered.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </HomeRow>
      )}

      {desired.length > 0 && (
        <HomeRow
          title={intl.formatMessage(messages.desired)}
          to='/hub/wachuneed/desired'
        >
          {desired.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </HomeRow>
      )}

      {shops.length > 0 && (
        <HomeRow
          title={intl.formatMessage(messages.shops)}
          to='/hub/wachuneed/shops'
        >
          {shops.map((shop) => (
            <ShopCard key={shop.id} shop={shop} />
          ))}
        </HomeRow>
      )}
    </div>
  );
};
