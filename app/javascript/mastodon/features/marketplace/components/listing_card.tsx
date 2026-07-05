import { FormattedMessage } from 'react-intl';

import type { MarketplaceListing } from '../types';

const CATEGORY_LABEL: Record<MarketplaceListing['category'], React.ReactNode> = {
  creation: (
    <FormattedMessage
      id='marketplace.category.creation'
      defaultMessage='Creation'
    />
  ),
  marketplace: (
    <FormattedMessage
      id='marketplace.category.marketplace'
      defaultMessage='Marketplace'
    />
  ),
  service: (
    <FormattedMessage
      id='marketplace.category.service'
      defaultMessage='Service'
    />
  ),
};

export const ListingCard: React.FC<{ listing: MarketplaceListing }> = ({
  listing,
}) => {
  const price = listing.price_display ?? '';

  return (
    <article className={`marketplace-card marketplace-card--${listing.category}`}>
      <header className='marketplace-card__header'>
        <span className='marketplace-card__category'>
          {CATEGORY_LABEL[listing.category]}
        </span>
        {price && <span className='marketplace-card__price'>{price}</span>}
      </header>

      <h3 className='marketplace-card__title'>{listing.title}</h3>

      {listing.description && (
        <p className='marketplace-card__description'>{listing.description}</p>
      )}

      <footer className='marketplace-card__meta'>
        <span className='marketplace-card__author'>
          @{listing.account.acct}
        </span>
        {listing.location && (
          <span className='marketplace-card__location'>· {listing.location}</span>
        )}
      </footer>
    </article>
  );
};
