import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Link, useHistory, useLocation } from 'react-router-dom';

import ArrowDownwardIcon from '@/material-icons/400-24px/arrow_downward.svg?react';
import ArrowUpwardIcon from '@/material-icons/400-24px/arrow_upward.svg?react';
import {
  apiGetWachugotListings,
  apiUpdateWachuneedListing,
  listingPath,
} from 'mastodon/api/wachuneed';
import { apiOrderWachuneedShop } from 'mastodon/api/wachuneed_shops';
import type { ApiShopSectionJSON } from 'mastodon/api/wachuneed_shops';
import type {
  ApiListingJSON,
  ListingAvailability,
  ListingVisibility,
} from 'mastodon/api_types/wachuneed';
import { EmptyState } from 'mastodon/components/empty_state';
import { Icon } from 'mastodon/components/icon';
import { LoadingState } from 'mastodon/components/loading_state';

import { ShopItemComposer } from './shop_item_composer';

// The Items part of the shop builder (docs/spaces/wachuneed.md, The shop
// builder): everything you have on offer in one list, to run a shop from.
// Add an item, open one to edit it, and flip whether it can be had without opening anything.
//
// Adding and editing open the shop item composer over the list. Which
// one is in the address (`?item=new`, `?item=<id>`), so the shop page can link straight to it and Back
// closes it.

const BUILDER = '/hub/wachuneed/my-shop';

// What is on offer and still up: a shop holds nothing else. In the shop's
// order, as the shop page shows it: what the seller placed, after anything
// not placed yet (newest first, as the server sends them).
const shopItems = (listings: ApiListingJSON[]) => {
  const items = listings.filter(
    (l) => l.kind !== 'wanted' && l.state !== 'closed',
  );
  const unplaced = items.filter((l) => typeof l.shop_position !== 'number');
  const placed = items
    .filter((l) => typeof l.shop_position === 'number')
    .sort((a, b) => (a.shop_position ?? 0) - (b.shop_position ?? 0));
  return [...unplaced, ...placed];
};

const messages = defineMessages({
  loading: { id: 'wachuneed.loading', defaultMessage: 'Loading listings…' },
  add: { id: 'wachuneed.shop_items.add', defaultMessage: 'Add an item' },
  empty: {
    id: 'wachuneed.shop_items.empty',
    defaultMessage: 'Nothing in your shop yet',
  },
  emptyBody: {
    id: 'wachuneed.shop_items.empty.body',
    defaultMessage:
      'Add what you make or sell. Items are added quietly: nothing is posted to the feed unless you choose to announce one.',
  },
  edit: { id: 'wachuneed.shop_items.edit', defaultMessage: 'Edit' },
  noSection: {
    id: 'wachuneed.shop.rest',
    defaultMessage: 'Everything else',
  },
  ongoing: { id: 'wachuneed.shop_items.ongoing', defaultMessage: 'Ongoing' },
  oneOff: { id: 'wachuneed.shop_items.one_off', defaultMessage: 'One-off' },
  availabilityOf: {
    id: 'wachuneed.variants.availability_for',
    defaultMessage: 'Availability of {kind}',
  },
  available: {
    id: 'wachuneed.availability.available',
    defaultMessage: 'Available',
  },
  soldOut: {
    id: 'wachuneed.availability.sold_out',
    defaultMessage: 'Sold out',
  },
  madeToOrder: {
    id: 'wachuneed.availability.made_to_order',
    defaultMessage: 'Made to order',
  },
  moveUp: {
    id: 'wachuneed.shop_items.move_up',
    defaultMessage: 'Move {item} up',
  },
  moveDown: {
    id: 'wachuneed.shop_items.move_down',
    defaultMessage: 'Move {item} down',
  },
});

const AVAILABILITY_LABELS = {
  available: messages.available,
  sold_out: messages.soldOut,
  made_to_order: messages.madeToOrder,
} as const;

const AVAILABILITIES = Object.keys(
  AVAILABILITY_LABELS,
) as ListingAvailability[];

export const ShopItems: React.FC<{
  sections: ApiShopSectionJSON[];
  // Who can see the shop: where a new item starts.
  shopVisibility: ListingVisibility;
}> = ({ sections, shopVisibility }) => {
  const intl = useIntl();
  const history = useHistory();
  const { search } = useLocation();
  const [items, setItems] = useState<ApiListingJSON[] | null>(null);

  const composing = useMemo<{ editId?: string } | null>(() => {
    const query = new URLSearchParams(search);
    const item = query.get('item');
    if (!item) return null;
    return item === 'new' ? {} : { editId: item };
  }, [search]);

  const closeComposer = useCallback(() => {
    history.replace(BUILDER);
  }, [history]);
  const handleSaved = useCallback(
    (again: boolean) => {
      void apiGetWachugotListings().then((data) => {
        setItems(shopItems(data));
        return undefined;
      });
      history.replace(
        again ? { pathname: BUILDER, search: '?item=new' } : BUILDER,
      );
    },
    [history],
  );

  useEffect(() => {
    let cancelled = false;

    apiGetWachugotListings()
      .then((data) => {
        if (!cancelled) setItems(shopItems(data));
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleAvailability = useCallback<
    React.ChangeEventHandler<HTMLSelectElement>
  >((e) => {
    const id = e.currentTarget.dataset.id ?? '';
    const availability = e.currentTarget.value as ListingAvailability;
    // Shown at once; put back if the server says no.
    setItems((prev) =>
      (prev ?? []).map((l) => (l.id === id ? { ...l, availability } : l)),
    );
    apiUpdateWachuneedListing(id, { availability }).catch(() => {
      void apiGetWachugotListings().then((data) => {
        setItems(shopItems(data));
        return undefined;
      });
    });
  }, []);

  // Up or down one place. Shown at once and saved as the whole order; put
  // back from the server if it says no.
  const handleMove = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
    (e) => {
      const { id, by } = e.currentTarget.dataset;
      const step = Number(by);
      setItems((prev) => {
        if (!prev) return prev;
        const from = prev.findIndex((l) => l.id === id);
        const to = from + step;
        if (from < 0 || to < 0 || to >= prev.length) return prev;
        const next = [...prev];
        const [moved] = next.splice(from, 1);
        if (moved) next.splice(to, 0, moved);
        const placed = next.map((l, position) => ({
          ...l,
          shop_position: position,
        }));
        apiOrderWachuneedShop(placed.map((l) => l.id)).catch(() => {
          void apiGetWachugotListings().then((data) => {
            setItems(shopItems(data));
            return undefined;
          });
        });
        return placed;
      });
    },
    [],
  );

  if (items === null) {
    return <LoadingState label={intl.formatMessage(messages.loading)} />;
  }

  const sectionName = (id?: string | null) =>
    sections.find((section) => section.id === id)?.name ??
    intl.formatMessage(messages.noSection);

  const addLink = (
    <Link
      to={{ pathname: BUILDER, search: '?item=new' }}
      className='wachuneed-shop-items__add'
    >
      <FormattedMessage {...messages.add} />
    </Link>
  );

  // Keyed by the item, so the form starts again for another one; a run of
  // new items shares one, which keeps the section between them.
  const composer = composing && (
    <ShopItemComposer
      key={composing.editId ?? 'new'}
      sections={sections}
      shopVisibility={shopVisibility}
      editId={composing.editId}
      onCancel={closeComposer}
      onSaved={handleSaved}
    />
  );

  // The composer keeps one place in the tree whether the list is empty or
  // not: adding the first item fills the list, and a composer that moved
  // with it would start again, losing "Added …" and the section.
  if (items.length === 0) {
    return (
      <>
        {composer}
        <EmptyState
          title={intl.formatMessage(messages.empty)}
          body={intl.formatMessage(messages.emptyBody)}
          action={addLink}
        />
      </>
    );
  }

  return (
    <>
      {composer}
      <div className='wachuneed-shop-items'>
        <div className='wachuneed__section-action'>{addLink}</div>

        <ul className='wachuneed-shop-items__list'>
          {items.map((item, index) => (
            <li key={item.id} className='wachuneed-shop-items__item'>
              <div className='wachuneed-shop-items__order'>
                <button
                  type='button'
                  className='wachuneed-options-edit__icon'
                  data-id={item.id}
                  data-by='-1'
                  onClick={handleMove}
                  disabled={index === 0}
                  aria-label={intl.formatMessage(messages.moveUp, {
                    item: item.title,
                  })}
                  title={intl.formatMessage(messages.moveUp, {
                    item: item.title,
                  })}
                >
                  <Icon id='arrow_upward' icon={ArrowUpwardIcon} />
                </button>
                <button
                  type='button'
                  className='wachuneed-options-edit__icon'
                  data-id={item.id}
                  data-by='1'
                  onClick={handleMove}
                  disabled={index === items.length - 1}
                  aria-label={intl.formatMessage(messages.moveDown, {
                    item: item.title,
                  })}
                  title={intl.formatMessage(messages.moveDown, {
                    item: item.title,
                  })}
                >
                  <Icon id='arrow_downward' icon={ArrowDownwardIcon} />
                </button>
              </div>

              {item.photo_url ? (
                <img
                  src={item.photo_url}
                  alt=''
                  className='wachuneed-shop-items__photo'
                />
              ) : (
                <span
                  className='wachuneed-shop-items__photo'
                  aria-hidden='true'
                />
              )}

              <div className='wachuneed-shop-items__body'>
                <Link
                  to={listingPath(item)}
                  className='wachuneed-shop-items__title'
                >
                  {item.title}
                </Link>
                <span className='wachuneed-shop-items__meta'>
                  {[
                    item.price_display,
                    sectionName(item.shop_section_id),
                    intl.formatMessage(
                      item.ongoing ? messages.ongoing : messages.oneOff,
                    ),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>

              <select
                className='wachuneed__compose-input wachuneed-shop-items__availability'
                value={item.availability ?? 'available'}
                data-id={item.id}
                onChange={handleAvailability}
                aria-label={intl.formatMessage(messages.availabilityOf, {
                  kind: item.title,
                })}
              >
                {AVAILABILITIES.map((value) => (
                  <option key={value} value={value}>
                    {intl.formatMessage(AVAILABILITY_LABELS[value])}
                  </option>
                ))}
              </select>

              <Link
                to={{ pathname: BUILDER, search: `?item=${item.id}` }}
                className='wachuneed-shop-items__action'
              >
                <FormattedMessage {...messages.edit} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};
