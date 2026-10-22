import { defineMessages, useIntl } from 'react-intl';

import InventoryIcon from '@/material-icons/400-24px/inventory_2.svg?react';
import { listingPath } from 'mastodon/api/wachuneed';
import type { ApiListingPhotoJSON } from 'mastodon/api_types/wachuneed';

import { ListingPhotos } from './listing_photos';
import { CardTitle, CardMeta, CardBody } from './standard_card';
import { StatusKornerCard } from './status_korner_card';

const messages = defineMessages({
  badge: {
    id: 'status_wachuneed_card.badge',
    defaultMessage: 'LISTING',
  },
  badgeWanted: {
    id: 'status_wachuneed_card.badge_wanted',
    defaultMessage: 'LOOKING FOR',
  },
});

// Category slugs from Listing::CATEGORIES (backend enum).
const CATEGORY_LABELS: Record<string, string> = {
  creation: 'Creation',
  goods: 'Goods',
  service: 'Service',
};

interface Listing {
  id: string;
  slug?: string;
  title: string;
  description?: string | null;
  category: string;
  kind?: 'offer' | 'wanted';
  subcategory?: string | null;
  price_display?: string | null;
  location?: string | null;
  photo_url?: string | null;
  photos?: ApiListingPhotoJSON[];
}

// A status cached before `photos` existed still has its cover.
const photosOf = (listing: Listing): ApiListingPhotoJSON[] =>
  listing.photos ??
  (listing.photo_url ? [{ id: 'cover', url: listing.photo_url }] : []);

export const StatusWachuneedCard: React.FC<{ listing: Listing }> = ({
  listing,
}) => {
  const intl = useIntl();

  return (
    <StatusKornerCard
      korner='Wachuneed'
      variant='listing'
      className='status-wachuneed-card'
      to={listingPath(listing)}
      badge={{
        icon: InventoryIcon,
        iconId: 'inventory_2',
        // A wanted post (Desired) reads as a request, not a sale.
        label: intl.formatMessage(
          listing.kind === 'wanted' ? messages.badgeWanted : messages.badge,
        ),
        tag: CATEGORY_LABELS[listing.category] ?? listing.category,
      }}
    >
      <ListingPhotos
        photos={photosOf(listing)}
        className='status-wachuneed-card__photos'
      />

      <div className='status-korner-card__body'>
        <CardTitle className='status-korner-card__title'>
          {listing.title}
        </CardTitle>
        {listing.description && (
          <CardBody className='status-korner-card__summary'>
            {listing.description}
          </CardBody>
        )}
      </div>

      <div className='status-korner-card__footer status-wachuneed-card__footer'>
        <CardMeta className='status-korner-card__meta'>
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
        </CardMeta>
      </div>
    </StatusKornerCard>
  );
};
