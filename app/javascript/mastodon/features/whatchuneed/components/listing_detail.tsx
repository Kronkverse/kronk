import { useState, useCallback } from 'react';

import { FormattedMessage, defineMessages, useIntl } from 'react-intl';

import ArrowBackIcon from '@/material-icons/400-24px/arrow_back.svg?react';
import CheckCircleIcon from '@/material-icons/400-24px/check_circle.svg?react';

import { Icon } from 'mastodon/components/icon';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';
import api from 'mastodon/api';

import type { WatchuNeedListing, WatchuNeedResponse } from '../types';
import { CATEGORY_LABELS } from '../types';

const messages = defineMessages({
  responsePlaceholder: { id: 'whatchuneed.response_placeholder', defaultMessage: 'I can help with this…' },
  sendResponse: { id: 'whatchuneed.send_response', defaultMessage: 'Send' },
  fulfillConfirm: { id: 'whatchuneed.fulfill_confirm', defaultMessage: 'Mark this as fulfilled?' },
});

interface Props {
  listing: WatchuNeedListing;
  currentAccountId: string | null;
  onBack: () => void;
  onFulfill: (id: string) => void;
}

export const ListingDetail: React.FC<Props> = ({ listing, currentAccountId, onBack, onFulfill }) => {
  const intl = useIntl();
  const [responses, setResponses] = useState<WatchuNeedResponse[]>(listing.responses ?? []);
  const [responseText, setResponseText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitResponse = useCallback(() => {
    const body = responseText.trim();
    if (!body || submitting) return;
    setSubmitting(true);

    api().post(`/api/v1/whatchuneed_listings/${listing.id}/whatchuneed_responses`, { response: { body } })
      .then(res => {
        setResponses(prev => [...prev, res.data as WatchuNeedResponse]);
        setResponseText('');
      })
      .catch(() => undefined)
      .finally(() => { setSubmitting(false); });
  }, [listing.id, responseText, submitting]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmitResponse();
    }
  }, [handleSubmitResponse]);

  const handleFulfill = useCallback(() => {
    if (!window.confirm(intl.formatMessage(messages.fulfillConfirm))) return;

    api().post(`/api/v1/whatchuneed_listings/${listing.id}/fulfill`)
      .then(() => { onFulfill(listing.id); })
      .catch(() => undefined);
  }, [listing.id, intl, onFulfill]);

  const isOwner = currentAccountId === listing.account.id;

  return (
    <div className='wtn-detail'>
      <div className='wtn-detail__nav'>
        <button className='wtn-detail__back' onClick={onBack} type='button'>
          <Icon id='arrow-back' icon={ArrowBackIcon} />
          <FormattedMessage id='whatchuneed.back' defaultMessage='All needs' />
        </button>
      </div>

      <div className='wtn-detail__head'>
        <div className='wtn-detail__meta'>
          {listing.category !== null && (
            <span className='wtn-card__category'>{CATEGORY_LABELS[listing.category]}</span>
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
        <h2 className='wtn-detail__title'>{listing.title}</h2>
        <div className='wtn-detail__author'>
          <img src={listing.account.avatar} alt='' aria-hidden='true' className='wtn-avatar wtn-avatar--md' />
          <span className='wtn-card__author-name'>
            {listing.account.display_name || listing.account.username}
          </span>
          <span className='wtn-card__time'>
            <RelativeTimestamp timestamp={listing.created_at} />
          </span>
        </div>
        <p className='wtn-detail__body'>{listing.body}</p>

        {isOwner && listing.status === 'open' && (
          <button className='wtn-detail__fulfill-btn' onClick={handleFulfill} type='button'>
            <Icon id='check-circle' icon={CheckCircleIcon} />
            <FormattedMessage id='whatchuneed.mark_fulfilled' defaultMessage='Mark as fulfilled' />
          </button>
        )}
      </div>

      <div className='wtn-detail__responses'>
        <h4 className='wtn-detail__responses-heading'>
          <FormattedMessage
            id='whatchuneed.responses_heading'
            defaultMessage='{count, plural, one {# response} other {# responses}}'
            values={{ count: responses.length }}
          />
        </h4>

        {responses.length === 0 && (
          <p className='wtn-detail__empty'>
            <FormattedMessage id='whatchuneed.no_responses' defaultMessage='No responses yet. Be the first to offer help!' />
          </p>
        )}

        <div className='wtn-detail__response-list'>
          {responses.map(r => (
            <div key={r.id} className='wtn-response'>
              <div className='wtn-response__author'>
                <img src={r.account.avatar} alt='' aria-hidden='true' className='wtn-avatar wtn-avatar--md' />
                <div className='wtn-response__author-info'>
                  <span className='wtn-response__author-name'>
                    {r.account.display_name || r.account.username}
                  </span>
                  <span className='wtn-card__time'>
                    <RelativeTimestamp timestamp={r.created_at} />
                  </span>
                </div>
              </div>
              <p className='wtn-response__body'>{r.body}</p>
            </div>
          ))}
        </div>

        {listing.status === 'open' && (
          <div className='wtn-detail__compose'>
            <textarea
              className='wtn-detail__compose-input'
              value={responseText}
              onChange={e => { setResponseText(e.target.value); }}
              onKeyDown={handleKeyDown}
              placeholder={intl.formatMessage(messages.responsePlaceholder)}
              rows={3}
              maxLength={1000}
            />
            <button
              className='wtn-detail__compose-submit'
              onClick={handleSubmitResponse}
              disabled={submitting || !responseText.trim()}
              type='button'
            >
              {intl.formatMessage(messages.sendResponse)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
