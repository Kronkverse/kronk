import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory, useLocation } from 'react-router-dom';

import { apiGetAllListings } from 'mastodon/api/wachuneed';
import { apiGetWachuneedShops } from 'mastodon/api/wachuneed_shops';
import type { ApiShopJSON } from 'mastodon/api/wachuneed_shops';
import type { ApiListingJSON } from 'mastodon/api_types/wachuneed';
import { ComposeSelect } from 'mastodon/components/compose_fields';
import { EmptyState } from 'mastodon/components/empty_state';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LoadingState } from 'mastodon/components/loading_state';
import { SpaceGrid } from 'mastodon/components/space_grid';

import { ListingCard } from './listing_card';
import { ShopCard } from './shop_card';

// /hub/wachuneed — Wachuneed on one page (Tal, 2026-11-16): the shops in a
// row that scrolls sideways along the top, then one grid of everything
// live, offered and wanted together, newest first. A Filter dropdown in
// the page's top right corner narrows the grid to what is Offered or
// Wanted (`?show=offered|wanted`; pills until 2026-11-16, then a Show
// dropdown above the grid until 2026-11-17, Tal). Each tile says Offered,
// Wanted or Mine (listing_card.tsx), so a mixed grid still reads. The grid
// is a section of its own under the shops, headed Listings, or Offered or
// Wanted when filtered (Tal, 2026-11-17).
//
// Until then the landing was a row each of Offered, Desired and Shops,
// each with See all to a section of its own (2026-10-29); those
// addresses now land here (index.tsx, config/routes.rb).

const messages = defineMessages({
  loading: { id: 'wachuneed.loading', defaultMessage: 'Loading listings…' },
  shops: { id: 'wachuneed.home.shops', defaultMessage: 'Shops' },
  listings: { id: 'wachuneed.home.listings', defaultMessage: 'Listings' },
  filter: { id: 'wachuneed.home.filter', defaultMessage: 'Filter' },
  all: { id: 'wachuneed.home.all', defaultMessage: 'All' },
  offered: { id: 'wachuneed.home.offered', defaultMessage: 'Offered' },
  wanted: { id: 'wachuneed.home.wanted', defaultMessage: 'Wanted' },
  empty: { id: 'wachuneed.empty', defaultMessage: 'Nothing on offer yet' },
  emptyBody: {
    id: 'wachuneed.empty.body',
    defaultMessage:
      'Art, stuff and offerings from the community show up here. Be the first to list something.',
  },
  emptyWanted: {
    id: 'wachumissing.empty',
    defaultMessage: 'Nobody is looking for anything yet',
  },
  emptyWantedBody: {
    id: 'wachumissing.empty.body',
    defaultMessage:
      'Need something? Say what you are after and the community can help.',
  },
  listSomething: {
    id: 'wachuneed.list_something',
    defaultMessage: 'List something',
  },
  postWanted: {
    id: 'wachuneed.post_wanted',
    defaultMessage: 'Post a wanted ad',
  },
});

const HOME_PATH = '/hub/wachuneed';

type Show = 'all' | 'offered' | 'wanted';

const isShow = (value: unknown): value is Show =>
  value === 'all' || value === 'offered' || value === 'wanted';

const showFrom = (search: string): Show => {
  const show = new URLSearchParams(search).get('show');
  return isShow(show) ? show : 'all';
};

export const WachuneedHome: React.FC = () => {
  const intl = useIntl();
  const history = useHistory();
  const { search } = useLocation();
  const show = showFrom(search);

  const [listings, setListings] = useState<ApiListingJSON[] | null>(null);
  const [shops, setShops] = useState<ApiShopJSON[]>([]);

  // Everything comes once; Filter only narrows what is already here.
  useEffect(() => {
    let cancelled = false;

    void Promise.allSettled([apiGetAllListings(), apiGetWachuneedShops()]).then(
      ([all, open]) => {
        if (cancelled) return undefined;
        // A part that fails to load is left out; the rest still shows.
        setListings(all.status === 'fulfilled' ? all.value : []);
        setShops(open.status === 'fulfilled' ? open.value : []);
        return undefined;
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  // A location object, not a string: this app's history.push drops a
  // `?query` given as a string.
  const handleShow = useCallback<React.ChangeEventHandler<HTMLSelectElement>>(
    (e) => {
      const next = e.currentTarget.value;
      if (!isShow(next)) return;
      history.replace({
        pathname: HOME_PATH,
        search: next === 'all' ? '' : `?show=${next}`,
      });
    },
    [history],
  );

  const wantedOnly = show === 'wanted';
  const handleNew = useCallback(() => {
    history.push({
      pathname: '/hub/wachuneed/new',
      search: wantedOnly ? '?kind=wanted' : '',
    });
  }, [history, wantedOnly]);

  if (!listings) {
    return <LoadingState label={intl.formatMessage(messages.loading)} />;
  }

  const shown = listings.filter((listing) =>
    show === 'all'
      ? true
      : show === 'wanted'
        ? listing.kind === 'wanted'
        : listing.kind !== 'wanted',
  );

  const newLabel = intl.formatMessage(
    wantedOnly ? messages.postWanted : messages.listSomething,
  );

  const listingsHeading = intl.formatMessage(
    show === 'wanted'
      ? messages.wanted
      : show === 'offered'
        ? messages.offered
        : messages.listings,
  );

  return (
    <div className='wachuneed-home'>
      <div className='wachuneed-home__bar'>
        <label className='wachuneed-home__filter'>
          <span className='wachuneed-home__filter-label'>
            {intl.formatMessage(messages.filter)}
          </span>
          <ComposeSelect value={show} onChange={handleShow}>
            <option value='all'>{intl.formatMessage(messages.all)}</option>
            <option value='offered'>
              {intl.formatMessage(messages.offered)}
            </option>
            <option value='wanted'>
              {intl.formatMessage(messages.wanted)}
            </option>
          </ComposeSelect>
        </label>
      </div>

      {shops.length > 0 && (
        <section
          className='wachuneed-home__row'
          aria-label={intl.formatMessage(messages.shops)}
        >
          <div className='wachuneed-home__head'>
            <h2 className='korner-section-heading'>
              {intl.formatMessage(messages.shops)}
            </h2>
          </div>
          <SpaceGrid layout='row' wide>
            {shops.map((shop) => (
              <ShopCard key={shop.id} shop={shop} />
            ))}
          </SpaceGrid>
        </section>
      )}

      <section className='wachuneed-home__row' aria-label={listingsHeading}>
        <div className='wachuneed-home__head'>
          <h2 className='korner-section-heading'>{listingsHeading}</h2>
          {/* Wanted ads have their own way in: the Ж menu's New listing
              is for something on offer. */}
          {wantedOnly && shown.length > 0 && (
            <KornerPill label={newLabel} onClick={handleNew} />
          )}
        </div>
        {shown.length === 0 ? (
          <EmptyState
            title={intl.formatMessage(
              wantedOnly ? messages.emptyWanted : messages.empty,
            )}
            body={intl.formatMessage(
              wantedOnly ? messages.emptyWantedBody : messages.emptyBody,
            )}
            action={
              <KornerPill
                label={newLabel}
                variant='primary'
                onClick={handleNew}
              />
            }
          />
        ) : (
          <SpaceGrid>
            {shown.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </SpaceGrid>
        )}
      </section>
    </div>
  );
};
