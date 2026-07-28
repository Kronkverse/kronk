import { defineMessages, useIntl } from 'react-intl';

import InventoryIcon from '@/material-icons/400-24px/inventory_2.svg?react';

import { StatusKornerCard } from './status_korner_card';

const messages = defineMessages({
  badge: {
    id: 'status_wachuneed_card.badge',
    defaultMessage: 'LISTING',
  },
  view: {
    id: 'status_wachuneed_card.view',
    defaultMessage: 'View listing',
  },
});

// Category slugs from Listing::CATEGORIES (backend enum).
const CATEGORY_LABELS: Record<string, string> = {
  creation: 'Creation',
  goods: 'Goods',
  service: 'Service',
};

// Route to the listing detail page; matches the SPA route we set up in
// features/ui/index.jsx for `/martketplace/listing/:id`.
const listingPath = (id: string) => `/martketplace/listing/${id}`;

interface Listing {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  subcategory?: string | null;
  price_display?: string | null;
  location?: string | null;
}

export const StatusWachuneedCard: React.FC<{ listing: Listing }> = ({
  listing,
}) => {
  const intl = useIntl();

  return (
    <StatusKornerCard
      korner='mARTketplace'
      variant='listing'
      className='status-wachuneed-card'
      to={listingPath(listing.id)}
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

      <div className='status-korner-card__footer status-wachuneed-card__footer'>
        <div className='status-korner-card__meta'>
          {listing.price_display && (
            <span className='status-wachuneed-card__price'>
              {listing.price_display}
            </span>
          )}
          {listing.location && (
            <span className='status-wachuneed-card__location'>
              {listing.location}
            </span>
          )}
          {listing.subcategory && (
            <span className='status-wachuneed-card__subcategory'>
              {listing.subcategory}
            </span>
          )}
        </div>
        <span className='status-korner-card__action'>
          {intl.formatMessage(messages.view)}
        </span>
      </div>
    </StatusKornerCard>
  );
};
