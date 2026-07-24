import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type { apiGetWachuneedListings } from 'mastodon/api/martketplace';
import type { ApiListingJSON } from 'mastodon/api_types/martketplace';

// Shared listing surface for both sub-views (Wachuneed / Wachugot).
// Which endpoint to hit is passed in as `loader` so the client-side
// filter tabs (Art / Stuff / Offerings / All) render the same way
// across both views — the only thing that changes is the scope of
// what came back from the API.

type FilterKey = 'all' | 'creation' | 'goods' | 'service';

const FILTER_KEYS: FilterKey[] = ['all', 'creation', 'goods', 'service'];

const messages = defineMessages({
  loading: {
    id: 'wachuneed.loading',
    defaultMessage: 'Loading listings…',
  },
  empty: {
    id: 'wachuneed.empty',
    defaultMessage: 'No live listings yet.',
  },
  emptyForFilter: {
    id: 'wachuneed.empty_for_filter',
    defaultMessage: 'Nothing in this category yet.',
  },
  emptyMine: {
    id: 'wachugot.empty',
    defaultMessage: "You haven't listed anything yet.",
  },
  emptyMineForFilter: {
    id: 'wachugot.empty_for_filter',
    defaultMessage: "You haven't listed anything in this category yet.",
  },
  filterAll: { id: 'wachuneed.filter.all', defaultMessage: 'All' },
  filterArt: {
    id: 'wachuneed.filter.art',
    defaultMessage: 'Art',
  },
  filterStuff: {
    id: 'wachuneed.filter.stuff',
    defaultMessage: 'Stuff',
  },
  filterOfferings: {
    id: 'wachuneed.filter.offerings',
    defaultMessage: 'Offerings',
  },
});

// Display labels for the three top-level categories. Server-side
// values stay as `creation` / `goods` / `service` — this map is just
// the user-facing rename per the mARTketplace pass.
const filterLabels: Record<FilterKey, typeof messages.filterAll> = {
  all: messages.filterAll,
  creation: messages.filterArt,
  goods: messages.filterStuff,
  service: messages.filterOfferings,
};

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

interface Props {
  loader: typeof apiGetWachuneedListings;
  scope: 'wachuneed' | 'wachugot';
}

export const WachuneedListings: React.FC<Props> = ({ loader, scope }) => {
  const intl = useIntl();
  const [listings, setListings] = useState<ApiListingJSON[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const data = await loader();
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
  }, [loader]);

  const visible = useMemo(() => {
    if (filter === 'all') return listings;
    return listings.filter((l) => l.category === filter);
  }, [listings, filter]);

  const emptyMessage =
    scope === 'wachugot'
      ? filter === 'all'
        ? messages.emptyMine
        : messages.emptyMineForFilter
      : filter === 'all'
        ? messages.empty
        : messages.emptyForFilter;

  return (
    <>
      <div className='wachuneed__filter-tabs'>
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
        <p className='wachuneed__status'>{intl.formatMessage(emptyMessage)}</p>
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
    </>
  );
};
