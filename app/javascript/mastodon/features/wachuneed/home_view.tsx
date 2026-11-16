import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory, useLocation } from 'react-router-dom';

import { apiGetAllListings } from 'mastodon/api/wachuneed';
import { apiGetWachuneedShops } from 'mastodon/api/wachuneed_shops';
import type { ApiShopJSON } from 'mastodon/api/wachuneed_shops';
import type { ApiListingJSON } from 'mastodon/api_types/wachuneed';
import { EmptyState } from 'mastodon/components/empty_state';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LoadingState } from 'mastodon/components/loading_state';
import { SpaceGrid } from 'mastodon/components/space_grid';

import { ListingCard } from './listing_card';
import { ShopCard } from './shop_card';

// /hub/wachuneed — Wachuneed on one page (Tal, 2026-11-16): the shops in a
// row that scrolls sideways along the top, then one grid of everything
// live, offered and wanted together, newest first. Pills above the grid
// narrow it to what is Offered or Wanted (`?show=offered|wanted`); each
// wanted tile carries a Wanted tag, so a mixed grid still reads.
//
// Until then the landing was a row each of Offered, Desired and Shops,
// each with See all to a section of its own (2026-10-29); those
// addresses now land here (index.tsx, config/routes.rb).

const messages = defineMessages({
  loading: { id: 'wachuneed.loading', defaultMessage: 'Loading listings…' },
  shops: { id: 'wachuneed.home.shops', defaultMessage: 'Shops' },
  show: { id: 'wachuneed.home.show', defaultMessage: 'Show' },
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

const showFrom = (search: string): Show => {
  const show = new URLSearchParams(search).get('show');
  return show === 'offered' || show === 'wanted' ? show : 'all';
};

export const WachuneedHome: React.FC = () => {
  const intl = useIntl();
  const history = useHistory();
  const { search } = useLocation();
  const show = showFrom(search);

  const [listings, setListings] = useState<ApiListingJSON[] | null>(null);
  const [shops, setShops] = useState<ApiShopJSON[]>([]);

  // Everything comes once; the pills only narrow what is already here.
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
  const showOnly = useCallback(
    (next: Show) => {
      history.replace({
        pathname: HOME_PATH,
        search: next === 'all' ? '' : `?show=${next}`,
      });
    },
    [history],
  );
  const handleAll = useCallback(() => {
    showOnly('all');
  }, [showOnly]);
  const handleOffered = useCallback(() => {
    showOnly('offered');
  }, [showOnly]);
  const handleWanted = useCallback(() => {
    showOnly('wanted');
  }, [showOnly]);

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

  return (
    <div className='wachuneed-home'>
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
          <SpaceGrid layout='row'>
            {shops.map((shop) => (
              <ShopCard key={shop.id} shop={shop} />
            ))}
          </SpaceGrid>
        </section>
      )}

      <nav
        className='wachuneed-home__show'
        aria-label={intl.formatMessage(messages.show)}
      >
        <KornerActionBar align='center'>
          <KornerPill
            label={intl.formatMessage(messages.all)}
            active={show === 'all'}
            onClick={handleAll}
          />
          <KornerPill
            label={intl.formatMessage(messages.offered)}
            active={show === 'offered'}
            onClick={handleOffered}
          />
          <KornerPill
            label={intl.formatMessage(messages.wanted)}
            active={wantedOnly}
            onClick={handleWanted}
          />
        </KornerActionBar>
      </nav>

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
        <>
          {/* Wanted ads have their own way in: the Ж menu's New listing
              is for something on offer. */}
          {wantedOnly && (
            <div className='wachuneed__section-action'>
              <KornerPill label={newLabel} onClick={handleNew} />
            </div>
          )}
          <SpaceGrid>
            {shown.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </SpaceGrid>
        </>
      )}
    </div>
  );
};
