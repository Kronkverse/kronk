import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import { apiGetWachuneedListings } from 'mastodon/api/wachuneed';
import type { ApiListingJSON } from 'mastodon/api_types/wachuneed';
import { Stage } from 'mastodon/components/stage';

// /hub/wachuneed browse page — Korner Standard L5 mount.
//
// Three top-level categories (creation / goods / service) drive the filter
// tabs. Filtering is client-side against the 40-listing window the API
// returns; a paginated + server-filtered variant lands in a follow-up.
//
// Listing detail, composer, and the 5 interaction modes (buy_now,
// buy_or_bargain, book_service, contact_to_discuss, workshop_join) are all
// follow-up slices — this page is discovery only.

type FilterKey = 'all' | 'creation' | 'goods' | 'service';

const FILTER_KEYS: FilterKey[] = ['all', 'creation', 'goods', 'service'];

const messages = defineMessages({
  title: { id: 'wachuneed.title', defaultMessage: 'Wachuneed' },
  loading: {
    id: 'wachuneed.loading',
    defaultMessage: 'Loading listings\u2026',
  },
  empty: { id: 'wachuneed.empty', defaultMessage: 'No live listings yet.' },
  emptyForFilter: {
    id: 'wachuneed.empty_for_filter',
    defaultMessage: 'Nothing in this category yet.',
  },
  filterAll: { id: 'wachuneed.filter.all', defaultMessage: 'All' },
  filterCreation: {
    id: 'wachuneed.filter.creation',
    defaultMessage: 'Creations',
  },
  filterGoods: {
    id: 'wachuneed.filter.goods',
    defaultMessage: 'Goods',
  },
  filterService: {
    id: 'wachuneed.filter.service',
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
  goods: messages.filterGoods,
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
      className={`wachuneed__filter-tab ${active ? 'wachuneed__filter-tab--active' : ''}`}
      onClick={handleClick}
    >
      {label}
    </button>
  );
};

const Wachuneed: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const [listings, setListings] = useState<ApiListingJSON[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await apiGetWachuneedListings();
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
    <Stage label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <div className='scrollable wachuneed'>
        <div className='wachuneed__filter-tabs' role='tablist'>
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
          <p className='wachuneed__status'>
            {intl.formatMessage(messages.loading)}
          </p>
        )}

        {!loading && visible.length === 0 && (
          <p className='wachuneed__status'>
            {intl.formatMessage(emptyMessage)}
          </p>
        )}

        <ul className='wachuneed__list'>
          {visible.map((listing) => (
            <li key={listing.id} className='wachuneed__item'>
              <div className='wachuneed__item-head'>
                <span className='wachuneed__item-title'>{listing.title}</span>
                {listing.price_display && (
                  <span className='wachuneed__item-price'>
                    {listing.price_display}
                  </span>
                )}
              </div>

              <div className='wachuneed__item-meta'>
                <span
                  className={`wachuneed__item-category wachuneed__item-category--${listing.category}`}
                >
                  {intl.formatMessage(labelForCategory(listing.category))}
                </span>
                {listing.location && (
                  <span className='wachuneed__item-location'>
                    {listing.location}
                  </span>
                )}
              </div>

              {listing.description && (
                <p className='wachuneed__item-desc'>{listing.description}</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default Wachuneed;
