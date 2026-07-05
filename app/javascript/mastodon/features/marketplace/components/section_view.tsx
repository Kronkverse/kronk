import { useCallback, useEffect, useState } from 'react';

import { FormattedMessage, useIntl } from 'react-intl';

import { Link, useHistory } from 'react-router-dom';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import ArrowBackIcon from '@/material-icons/400-24px/arrow_back.svg?react';
import api from 'mastodon/api';
import { useIdentity } from 'mastodon/identity_context';

import type { MarketplaceCategory, MarketplaceListing } from '../types';
import { ListingCard } from './listing_card';

const SECTION_URL_SLUG: Record<MarketplaceCategory, string> = {
  creation: 'creations',
  marketplace: 'marketplace',
  service: 'services',
};

const SECTION_META: Record<
  MarketplaceCategory,
  { title: React.ReactNode; desc: React.ReactNode; variant: string }
> = {
  creation: {
    title: (
      <FormattedMessage
        id='marketplace.door.creations.title'
        defaultMessage='Creations'
      />
    ),
    desc: (
      <FormattedMessage
        id='marketplace.door.creations.desc'
        defaultMessage="Art, illustration, music, digital work, handmade objects. The gallery of the community's making."
      />
    ),
    variant: 'creation',
  },
  marketplace: {
    title: (
      <FormattedMessage
        id='marketplace.door.marketplace.title'
        defaultMessage='Marketplace'
      />
    ),
    desc: (
      <FormattedMessage
        id='marketplace.door.marketplace.desc'
        defaultMessage='General listings, goods, and items — new and used. Browse by category.'
      />
    ),
    variant: 'market',
  },
  service: {
    title: (
      <FormattedMessage
        id='marketplace.door.services.title'
        defaultMessage='Services'
      />
    ),
    desc: (
      <FormattedMessage
        id='marketplace.door.services.desc'
        defaultMessage='Offerings, skills, sessions, and expertise. Connect with practitioners and guides.'
      />
    ),
    variant: 'service',
  },
};

export const SectionView: React.FC<{ category: MarketplaceCategory }> = ({
  category,
}) => {
  const intl = useIntl();
  const history = useHistory();
  const { signedIn } = useIdentity();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);

  const meta = SECTION_META[category];

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api().get<MarketplaceListing[]>(
        '/api/v1/marketplace/listings',
        { params: { category } },
      );
      setListings(res.data);
    } catch (err) {
      console.error('Failed to fetch listings:', err);
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    void fetchListings();
  }, [fetchListings]);

  const backLabel = intl.formatMessage({
    id: 'marketplace.back_to_doors',
    defaultMessage: 'Back to Marketplace',
  });

  return (
    <div className={`marketplace-section marketplace-section--${meta.variant}`}>
      <button
        type='button'
        className='marketplace-back'
        onClick={() => {
          history.push('/marketplace');
        }}
        aria-label={backLabel}
      >
        <ArrowBackIcon width={16} height={16} />
        <span>{backLabel}</span>
      </button>

      <header className='marketplace-section__header'>
        <p className='marketplace-eyebrow'>
          <FormattedMessage
            id='marketplace.section.eyebrow'
            defaultMessage='Threshold'
          />
        </p>
        <h2 className='marketplace-section__title'>{meta.title}</h2>
        <p className='marketplace-section__desc'>{meta.desc}</p>
        {signedIn && (
          <Link
            className='marketplace-section__add'
            to={{
              pathname: '/marketplace/new',
              search: `?section=${SECTION_URL_SLUG[category]}`,
            }}
          >
            <AddIcon width={14} height={14} />
            <span>
              <FormattedMessage
                id='marketplace.section.add'
                defaultMessage='Add {section, select, creation {a creation} marketplace {a listing} service {a service} other {a listing}}'
                values={{ section: category }}
              />
            </span>
          </Link>
        )}
      </header>

      {loading ? (
        <div className='marketplace-page__loading'>
          <FormattedMessage
            id='marketplace.loading'
            defaultMessage='Loading listings…'
          />
        </div>
      ) : listings.length === 0 ? (
        <div className='marketplace-page__empty'>
          <FormattedMessage
            id='marketplace.empty'
            defaultMessage='No listings here yet.'
          />
        </div>
      ) : (
        <div className='marketplace-page__grid'>
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
};
