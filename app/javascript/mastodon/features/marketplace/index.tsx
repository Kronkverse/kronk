import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import { apiGetMarketplaceListings } from 'mastodon/api/marketplace';
import type { ApiListingJSON } from 'mastodon/api_types/marketplace';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

// /hub/marketplace browse page — Korner Standard L5 mount.
//
// Three top-level categories (creations / marketplace / services) drive the
// filter tabs, matching the rebuild doc (`~/kronk-notes/korners/marketplace.md`
// §"The three top-level categories"). Filtering is client-side against the
// 40-listing window the API returns; a paginated + server-filtered variant
// lands in a follow-up.
//
// Listing detail, composer, and the 5 interaction modes (buy_now,
// buy_or_bargain, book_service, contact_to_discuss, workshop_join) are all
// follow-up slices — this page is discovery only.

type FilterKey = 'all' | 'creation' | 'marketplace' | 'service';

const FILTER_KEYS: FilterKey[] = ['all', 'creation', 'marketplace', 'service'];

const messages = defineMessages({
  title: { id: 'marketplace.title', defaultMessage: 'Marketplace' },
  loading: {
    id: 'marketplace.loading',
    defaultMessage: 'Loading listings\u2026',
  },
  empty: { id: 'marketplace.empty', defaultMessage: 'No live listings yet.' },
  emptyForFilter: {
    id: 'marketplace.empty_for_filter',
    defaultMessage: 'Nothing in this category yet.',
  },
  filterAll: { id: 'marketplace.filter.all', defaultMessage: 'All' },
  filterCreation: {
    id: 'marketplace.filter.creation',
    defaultMessage: 'Creations',
  },
  filterMarketplace: {
    id: 'marketplace.filter.marketplace',
    defaultMessage: 'Marketplace',
  },
  filterService: {
    id: 'marketplace.filter.service',
    defaultMessage: 'Services',
  },
});

// Keyed by FilterKey, not `string`. The permissive shape it replaces made
// *every* lookup optional — including `filterLabels.all`, which meant the
// `?? filterLabels.all` fallback was itself possibly-undefined and never
// actually guaranteed a label.
const filterLabels: Record<FilterKey, typeof messages.filterAll> = {
  all: messages.filterAll,
  creation: messages.filterCreation,
  marketplace: messages.filterMarketplace,
  service: messages.filterService,
};

// A listing's `category` is a loose string from the API, so it needs a real
// membership check before it can index the table.
const labelForCategory = (category: string) =>
  category in filterLabels
    ? filterLabels[category as FilterKey]
    : filterLabels.all;

interface FilterTabProps {
  filterKey: FilterKey;
  active: boolean;
  label: string;
  onSelect: (key: FilterKey) => void;
}

const FilterTab: React.FC<FilterTabProps> = ({
  filterKey,
  active,
  label,
  onSelect,
}) => {
  const handleClick = useCallback(() => {
    onSelect(filterKey);
  }, [filterKey, onSelect]);

  return (
    <button
      type='button'
      className={`marketplace__filter-tab ${active ? 'marketplace__filter-tab--active' : ''}`}
      onClick={handleClick}
    >
      {label}
    </button>
  );
};

const Marketplace: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const Icon = useKornerIcon('marketplace');
  const [listings, setListings] = useState<ApiListingJSON[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await apiGetMarketplaceListings();
        if (!cancelled) setListings(data);
      } catch {
        // Leave the list empty on error; the page still renders.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    if (filter === 'all') return listings;
    return listings.filter((l) => l.category === filter);
  }, [listings, filter]);

  const emptyMessage =
    filter === 'all' ? messages.empty : messages.emptyForFilter;

  return (
    <Column bindToDocument label={intl.formatMessage(messages.title)}>
      <ColumnHeader
        title={intl.formatMessage(messages.title)}
        icon='korner'
        iconComponent={Icon}
        showBackButton
        multiColumn={multiColumn}
      />

      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <div className='scrollable marketplace'>
        <div className='marketplace__filter-tabs' role='tablist'>
          {FILTER_KEYS.map((key) => (
            <FilterTab
              key={key}
              filterKey={key}
              active={filter === key}
              label={intl.formatMessage(filterLabels[key])}
              onSelect={setFilter}
            />
          ))}
        </div>

        {loading && (
          <p className='marketplace__status'>
            {intl.formatMessage(messages.loading)}
          </p>
        )}

        {!loading && visible.length === 0 && (
          <p className='marketplace__status'>
            {intl.formatMessage(emptyMessage)}
          </p>
        )}

        <ul className='marketplace__list'>
          {visible.map((listing) => (
            <li key={listing.id} className='marketplace__item'>
              <div className='marketplace__item-head'>
                <span className='marketplace__item-title'>{listing.title}</span>
                {listing.price_display && (
                  <span className='marketplace__item-price'>
                    {listing.price_display}
                  </span>
                )}
              </div>

              <div className='marketplace__item-meta'>
                <span
                  className={`marketplace__item-category marketplace__item-category--${listing.category}`}
                >
                  {intl.formatMessage(labelForCategory(listing.category))}
                </span>
                {listing.location && (
                  <span className='marketplace__item-location'>
                    {listing.location}
                  </span>
                )}
              </div>

              {listing.description && (
                <p className='marketplace__item-desc'>{listing.description}</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export
export default Marketplace;
