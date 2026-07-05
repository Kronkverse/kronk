import { useCallback, useEffect, useState } from 'react';

import { FormattedMessage, defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import api from 'mastodon/api';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { planetIcon, spaceColor } from 'mastodon/planets';

import { ListingCard } from './components/listing_card';
import type { MarketplaceCategory, MarketplaceListing } from './types';

const messages = defineMessages({
  heading: { id: 'marketplace.title', defaultMessage: 'Marketplace' },
  loading: { id: 'marketplace.loading', defaultMessage: 'Loading listings…' },
  empty: {
    id: 'marketplace.empty',
    defaultMessage: 'No listings here yet.',
  },
});

type Tab = 'all' | MarketplaceCategory;

const TAB_LABELS: Record<Tab, React.ReactNode> = {
  all: <FormattedMessage id='marketplace.tab.all' defaultMessage='All' />,
  creation: (
    <FormattedMessage
      id='marketplace.tab.creations'
      defaultMessage='Creations'
    />
  ),
  marketplace: (
    <FormattedMessage
      id='marketplace.tab.marketplace'
      defaultMessage='Marketplace'
    />
  ),
  service: (
    <FormattedMessage id='marketplace.tab.services' defaultMessage='Services' />
  ),
};

const Marketplace: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const [tab, setTab] = useState<Tab>('all');
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const params = tab === 'all' ? {} : { category: tab };
      const res = await api().get<MarketplaceListing[]>(
        '/api/v1/marketplace/listings',
        { params },
      );
      setListings(res.data);
    } catch (err) {
      console.error('Failed to fetch listings:', err);
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void fetchListings();
  }, [fetchListings]);

  return (
    <Column bindToDocument={!multiColumn}>
      <ColumnHeader
        icon='storefront'
        iconComponent={planetIcon('Marketplace')}
        title={intl.formatMessage(messages.heading)}
        multiColumn={multiColumn}
      />

      <div
        className='marketplace-page scrollable'
        style={
          { '--space-color': spaceColor('Marketplace') } as React.CSSProperties
        }
      >
        <div className='marketplace-tabs'>
          {(['all', 'creation', 'marketplace', 'service'] as Tab[]).map((t) => (
            <button
              key={t}
              type='button'
              className={
                'marketplace-tabs__tab' +
                (tab === t ? ' marketplace-tabs__tab--active' : '')
              }
              onClick={() => {
                setTab(t);
              }}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className='marketplace-page__loading'>
            {intl.formatMessage(messages.loading)}
          </div>
        ) : listings.length === 0 ? (
          <div className='marketplace-page__empty'>
            {intl.formatMessage(messages.empty)}
          </div>
        ) : (
          <div className='marketplace-page__grid'>
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>

      <Helmet>
        <title>{intl.formatMessage(messages.heading)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>
    </Column>
  );
};

export default Marketplace;
