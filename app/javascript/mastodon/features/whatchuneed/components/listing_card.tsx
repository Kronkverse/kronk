import { useCallback } from 'react';

import { FormattedMessage, useIntl, defineMessages } from 'react-intl';

import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';

import type { WatchuNeedListing } from '../types';
import { CATEGORY_LABELS } from '../types';

const messages = defineMessages({
  responses: { id: 'whatchuneed.responses', defaultMessage: '{count, plural, one {# response} other {# responses}}' },
});

interface Props {
  listing: WatchuNeedListing;
  onSelect: (id: string) => void;
}

export const ListingCard: React.FC<Props> = ({ listing, onSelect }) => {
  const intl = useIntl();

  const handleClick = useCallback(() => {
    onSelect(listing.id);
  }, [listing.id, onSelect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(listing.id);
    }
  }, [listing.id, onSelect]);

  return (
    <div
      className='wtn-card'
      role='button'
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className='wtn-card__header'>
        {listing.category !== null && (
          <span className='wtn-card__category'>
            {CATEGORY_LABELS[listing.category]}
          </span>
        )}
        {listing.status !== 'open' && (
          <span className={`wtn-card__status wtn-card__status--${listing.status}`}>
            {listing.status === 'fulfilled' ? (
              <FormattedMessage id='whatchuneed.status.fulfilled' defaultMessage='Fulfilled' />
            ) : (
              <FormattedMessage id='whatchuneed.status.closed' defaultMessage='Closed' />
            )}
          </span>
        )}
      </div>

      <h3 className='wtn-card__title'>{listing.title}</h3>
      <p className='wtn-card__body'>{listing.body}</p>

      <div className='wtn-card__footer'>
        <div className='wtn-card__author'>
          <img src={listing.account.avatar} alt='' aria-hidden='true' className='wtn-avatar wtn-avatar--sm' />
          <span className='wtn-card__author-name'>
            {listing.account.display_name || listing.account.username}
          </span>
          <span className='wtn-card__time'>
            <RelativeTimestamp timestamp={listing.created_at} />
          </span>
        </div>
        <span className='wtn-card__response-count'>
          {intl.formatMessage(messages.responses, { count: listing.response_count })}
        </span>
      </div>
    </div>
  );
};
