import { useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import { apiGetMarketplaceListings } from 'mastodon/api/marketplace';
import type { ApiListingJSON } from 'mastodon/api_types/marketplace';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

// Minimal /hub/marketplace browse page (Korner Standard L5) — lists the live
// listings from the marketplace API. A fuller browse/detail UI is a follow-up;
// this is the enforced-conformant mount that proves the Standard end-to-end.

const messages = defineMessages({
  title: { id: 'marketplace.title', defaultMessage: 'Marketplace' },
  loading: { id: 'marketplace.loading', defaultMessage: 'Loading listings…' },
  empty: { id: 'marketplace.empty', defaultMessage: 'No live listings yet.' },
});

const Marketplace: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const Icon = useKornerIcon('marketplace');
  const [listings, setListings] = useState<ApiListingJSON[]>([]);
  const [loading, setLoading] = useState(true);

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
        {loading && (
          <p className='marketplace__status'>
            {intl.formatMessage(messages.loading)}
          </p>
        )}

        {!loading && listings.length === 0 && (
          <p className='marketplace__status'>
            {intl.formatMessage(messages.empty)}
          </p>
        )}

        <ul className='marketplace__list'>
          {listings.map((listing) => (
            <li key={listing.id} className='marketplace__item'>
              <div className='marketplace__item-head'>
                <span className='marketplace__item-title'>{listing.title}</span>
                {listing.price_display && (
                  <span className='marketplace__item-price'>
                    {listing.price_display}
                  </span>
                )}
              </div>
              <span className='kategory-pill'>{listing.category}</span>
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
