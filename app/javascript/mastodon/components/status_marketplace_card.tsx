import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import InventoryIcon from '@/material-icons/400-24px/inventory_2.svg?react';

import { StatusKornerCard } from './status_korner_card';

const messages = defineMessages({
  badge: {
    id: 'status_marketplace_card.badge',
    defaultMessage: 'LISTING',
  },
  view: {
    id: 'status_marketplace_card.view',
    defaultMessage: 'View listing',
  },
});

// Sub-category slugs from MarketplaceListing::CATEGORY_LABELS (backend enum).
const CATEGORY_LABELS: Record<string, string> = {
  creation: 'Creation',
  marketplace: 'Marketplace',
  service: 'Service',
};

// Route to the listing detail page; matches the SPA route we set up in
// features/ui/index.jsx for `/marketplace/listing/:id`.
const listingPath = (id: string) => `/marketplace/listing/${id}`;

interface Listing {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  subcategory?: string | null;
  price_display?: string | null;
  location?: string | null;
}

export const StatusMarketplaceCard: React.FC<{ listing: Listing }> = ({
  listing,
}) => {
  const intl = useIntl();

  const handleLinkClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <StatusKornerCard
      korner='Marketplace'
      variant='listing'
      className='status-marketplace-card'
      badge={{
        icon: InventoryIcon,
        iconId: 'inventory_2',
        label: intl.formatMessage(messages.badge),
        tag: CATEGORY_LABELS[listing.category] ?? listing.category,
      }}
    >
      <div className='status-korner-card__body'>
        <div className='status-korner-card__title'>{listing.title}</div>
        {listing.description && (
          <div className='status-korner-card__summary'>
            {listing.description}
          </div>
        )}
      </div>

      <div className='status-korner-card__footer status-marketplace-card__footer'>
        <div className='status-korner-card__meta'>
          {listing.price_display && (
            <span className='status-marketplace-card__price'>
              {listing.price_display}
            </span>
          )}
          {listing.location && (
            <span className='status-marketplace-card__location'>
              {listing.location}
            </span>
          )}
          {listing.subcategory && (
            <span className='status-marketplace-card__subcategory'>
              {listing.subcategory}
            </span>
          )}
        </div>
        <Link
          to={listingPath(listing.id)}
          className='status-korner-card__action'
          onClick={handleLinkClick}
        >
          {intl.formatMessage(messages.view)}
        </Link>
      </div>
    </StatusKornerCard>
  );
};
