import { useEffect, useState } from 'react';

import { FormattedMessage, defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';

import ArrowBackIcon from '@/material-icons/400-24px/arrow_back.svg?react';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import api from 'mastodon/api';
import { planetIcon, spaceColor } from 'mastodon/planets';

import type { MarketplaceListing } from '../types';

const messages = defineMessages({
  heading: { id: 'marketplace.detail.heading', defaultMessage: 'Listing' },
  back: {
    id: 'marketplace.detail.back',
    defaultMessage: 'Back to Marketplace',
  },
  notFound: {
    id: 'marketplace.detail.not_found',
    defaultMessage: 'This listing is no longer available.',
  },
  loading: {
    id: 'marketplace.detail.loading',
    defaultMessage: 'Loading listing…',
  },
});

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

type LoadState = 'loading' | 'ok' | 'not_found';

const ListingDetail: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const { id } = useParams<{ id: string }>();
  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');

  useEffect(() => {
    if (!id) return undefined;

    let cancelled = false;
    setLoadState('loading');

    api()
      .get<MarketplaceListing>(`/api/v1/marketplace/listings/${id}`)
      .then((res) => {
        if (cancelled) return;
        setListing(res.data);
        setLoadState('ok');
      })
      .catch(() => {
        if (cancelled) return;
        setLoadState('not_found');
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const title = listing?.title ?? intl.formatMessage(messages.heading);

  return (
    <Column bindToDocument={!multiColumn}>
      <ColumnHeader
        icon='inventory_2'
        iconComponent={planetIcon('Marketplace')}
        title={title}
        multiColumn={multiColumn}
      />

      <div
        className='marketplace-page marketplace-detail scrollable'
        style={
          { '--space-color': spaceColor('Marketplace') } as React.CSSProperties
        }
      >
        <Link className='marketplace-back' to='/marketplace'>
          <ArrowBackIcon width={16} height={16} />
          <span>{intl.formatMessage(messages.back)}</span>
        </Link>

        {loadState === 'loading' && (
          <div className='marketplace-page__loading'>
            <FormattedMessage {...messages.loading} />
          </div>
        )}

        {loadState === 'not_found' && (
          <div className='marketplace-page__empty'>
            <FormattedMessage {...messages.notFound} />
          </div>
        )}

        {loadState === 'ok' && listing && (
          <article
            className={`marketplace-detail__body marketplace-detail__body--${listing.category}`}
          >
            <header className='marketplace-detail__header'>
              <span className='marketplace-detail__category'>
                {CATEGORY_LABEL[listing.category]}
              </span>
              {listing.price_display && (
                <span className='marketplace-detail__price'>
                  {listing.price_display}
                </span>
              )}
            </header>

            <h1 className='marketplace-detail__title'>{listing.title}</h1>

            {listing.subcategory && (
              <p className='marketplace-detail__subcategory'>
                {listing.subcategory}
              </p>
            )}

            {listing.description && (
              <div className='marketplace-detail__description'>
                {listing.description}
              </div>
            )}

            {listing.location && (
              <div className='marketplace-detail__location'>
                <FormattedMessage
                  id='marketplace.detail.location'
                  defaultMessage='Location: {location}'
                  values={{ location: listing.location }}
                />
              </div>
            )}

            <footer className='marketplace-detail__footer'>
              <Link
                className='marketplace-detail__author'
                to={`/@${listing.account.acct}`}
              >
                <img
                  className='marketplace-detail__avatar'
                  src={listing.account.avatar}
                  alt=''
                  width={40}
                  height={40}
                />
                <span className='marketplace-detail__author-name'>
                  <strong>
                    {listing.account.display_name || listing.account.username}
                  </strong>
                  <span className='marketplace-detail__author-acct'>
                    @{listing.account.acct}
                  </span>
                </span>
              </Link>

              <time
                className='marketplace-detail__date'
                dateTime={listing.created_at}
              >
                {intl.formatDate(listing.created_at, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </time>
            </footer>
          </article>
        )}
      </div>

      <Helmet>
        <title>{title}</title>
      </Helmet>
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export
export default ListingDetail;
