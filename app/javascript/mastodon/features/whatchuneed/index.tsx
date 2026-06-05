import { useRef, useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import AddIcon from '@/material-icons/400-24px/add.svg?react';

import { Column } from 'mastodon/components/column';
import type { ColumnRef } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { Icon } from 'mastodon/components/icon';
import api from 'mastodon/api';
import { me } from 'mastodon/initial_state';
import { planetIcon, planetName, spaceColor } from 'mastodon/planets';

import type { WatchuNeedListing } from './types';
import { CATEGORY_LABELS } from './types';
import type { ListingCategory } from './types';
import { ListingCard } from './components/listing_card';
import { ListingDetail } from './components/listing_detail';
import { NewListingForm } from './components/new_listing_form';

const messages = defineMessages({
  heading: { id: 'whatchuneed.title', defaultMessage: 'WatchuNeed' },
  allCategories: { id: 'whatchuneed.all_categories', defaultMessage: 'All' },
  newListing: { id: 'whatchuneed.new_listing_btn', defaultMessage: 'Post a need' },
  empty: { id: 'whatchuneed.empty', defaultMessage: 'Nothing posted yet. Be the first!' },
});

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ListingCategory[];

const WatchuNeed: React.FC<{ multiColumn: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const columnRef = useRef<ColumnRef>(null);
  const currentAccountId = me ?? null;

  const [listings, setListings] = useState<WatchuNeedListing[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedListing, setSelectedListing] = useState<WatchuNeedListing | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<ListingCategory | ''>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = categoryFilter !== '' ? { category: categoryFilter } : {};
    setLoading(true);
    api().get('/api/v1/whatchuneed_listings', { params })
      .then(res => { setListings(res.data as WatchuNeedListing[]); })
      .catch(() => undefined)
      .finally(() => { setLoading(false); });
  }, [categoryFilter]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedListing(null);
      return;
    }
    api().get(`/api/v1/whatchuneed_listings/${selectedId}`)
      .then(res => { setSelectedListing(res.data as WatchuNeedListing); })
      .catch(() => { setSelectedId(null); });
  }, [selectedId]);

  const handleHeaderClick = useCallback(() => {
    columnRef.current?.scrollTop();
  }, []);

  const handleCreated = useCallback((listing: WatchuNeedListing) => {
    setListings(prev => [listing, ...prev]);
    setShowForm(false);
  }, []);

  const handleFulfill = useCallback((id: string) => {
    setListings(prev => prev.map(l => l.id === id ? { ...l, status: 'fulfilled' as const } : l));
    setSelectedListing(prev => prev?.id === id ? { ...prev, status: 'fulfilled' as const } : prev);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedId(null);
    setSelectedListing(null);
  }, []);

  return (
    <Column
      bindToDocument={!multiColumn}
      ref={columnRef}
      label={intl.formatMessage(messages.heading)}
    >
      <ColumnHeader
        title={planetName('WatchuNeed')}
        icon='partner_exchange'
        iconComponent={planetIcon('WatchuNeed')}
        onClick={handleHeaderClick}
        multiColumn={multiColumn}
      />

      <div
        className='whatchuneed-page scrollable'
        style={{ '--space-color': spaceColor('WatchuNeed') } as React.CSSProperties}
      >
        {selectedListing !== null ? (
          <ListingDetail
            listing={selectedListing}
            currentAccountId={currentAccountId}
            onBack={handleBack}
            onFulfill={handleFulfill}
          />
        ) : (
          <>
            <div className='whatchuneed-page__toolbar'>
              <div className='whatchuneed-page__filters'>
                <button
                  className={`whatchuneed-page__filter-btn${categoryFilter === '' ? ' whatchuneed-page__filter-btn--active' : ''}`}
                  onClick={() => { setCategoryFilter(''); }}
                  type='button'
                >
                  {intl.formatMessage(messages.allCategories)}
                </button>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    className={`whatchuneed-page__filter-btn${categoryFilter === cat ? ' whatchuneed-page__filter-btn--active' : ''}`}
                    onClick={() => { setCategoryFilter(cat); }}
                    type='button'
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>

              <button
                className='whatchuneed-page__post-btn'
                onClick={() => { setShowForm(true); }}
                type='button'
              >
                <Icon id='add' icon={AddIcon} />
                {intl.formatMessage(messages.newListing)}
              </button>
            </div>

            {loading && (
              <div className='whatchuneed-page__loading'>
                <span className='loading-indicator' />
              </div>
            )}

            {!loading && listings.length === 0 && (
              <p className='whatchuneed-page__empty'>{intl.formatMessage(messages.empty)}</p>
            )}

            <div className='whatchuneed-page__grid'>
              {listings.map(listing => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  onSelect={setSelectedId}
                />
              ))}
            </div>
          </>
        )}

        {showForm && (
          <NewListingForm
            onCreated={handleCreated}
            onClose={() => { setShowForm(false); }}
          />
        )}
      </div>

      <Helmet>
        <title>{intl.formatMessage(messages.heading)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export
export default WatchuNeed;
