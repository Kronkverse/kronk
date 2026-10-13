import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Link } from 'react-router-dom';

import {
  apiGetWachugotListings,
  apiUpdateWachuneedListing,
} from 'mastodon/api/wachuneed';
import type { ApiShopSectionJSON } from 'mastodon/api/wachuneed_shops';
import type {
  ApiListingJSON,
  ListingAvailability,
} from 'mastodon/api_types/wachuneed';
import { EmptyState } from 'mastodon/components/empty_state';
import { LoadingState } from 'mastodon/components/loading_state';

// The Items part of the shop builder (docs/spaces/wachuneed.md, The shop
// builder): everything you have on offer in one list, to run a shop from.
// Add an item, open one to edit it, copy one to start the next, and flip
// whether it can be had without opening anything.

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
  copy: { id: 'wachuneed.shop_items.copy', defaultMessage: 'Copy' },
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
});

const AVAILABILITY_LABELS = {
  available: messages.available,
  sold_out: messages.soldOut,
  made_to_order: messages.madeToOrder,
} as const;

const AVAILABILITIES = Object.keys(
  AVAILABILITY_LABELS,
) as ListingAvailability[];

export const ShopItems: React.FC<{ sections: ApiShopSectionJSON[] }> = ({
  sections,
}) => {
  const intl = useIntl();
  const [items, setItems] = useState<ApiListingJSON[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiGetWachugotListings()
      .then((data) => {
        // A shop holds what is on offer and still up.
        if (!cancelled)
          setItems(
            data.filter((l) => l.kind !== 'wanted' && l.state !== 'closed'),
          );
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
        setItems(
          data.filter((l) => l.kind !== 'wanted' && l.state !== 'closed'),
        );
        return undefined;
      });
    });
  }, []);

  if (items === null) {
    return <LoadingState label={intl.formatMessage(messages.loading)} />;
  }

  const sectionName = (id?: string | null) =>
    sections.find((section) => section.id === id)?.name ??
    intl.formatMessage(messages.noSection);

  const addLink = (
    <Link
      to={{ pathname: '/hub/wachuneed/new', search: '?shop=1' }}
      className='wachuneed-shop-items__add'
    >
      <FormattedMessage {...messages.add} />
    </Link>
  );

  if (items.length === 0) {
    return (
      <EmptyState
        title={intl.formatMessage(messages.empty)}
        body={intl.formatMessage(messages.emptyBody)}
        action={addLink}
      />
    );
  }

  return (
    <div className='wachuneed-shop-items'>
      <div className='wachuneed__section-action'>{addLink}</div>

      <ul className='wachuneed-shop-items__list'>
        {items.map((item) => (
          <li key={item.id} className='wachuneed-shop-items__item'>
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
                to={`/hub/wachuneed/listings/${item.id}`}
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
              to={{
                pathname: `/hub/wachuneed/listings/${item.id}/edit`,
                search: '?shop=1',
              }}
              className='wachuneed-shop-items__action'
            >
              <FormattedMessage {...messages.edit} />
            </Link>
            <Link
              to={{
                pathname: '/hub/wachuneed/new',
                search: `?shop=1&copy=${item.id}`,
              }}
              className='wachuneed-shop-items__action'
            >
              <FormattedMessage {...messages.copy} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};
