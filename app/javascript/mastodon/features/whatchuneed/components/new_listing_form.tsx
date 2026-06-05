import { useState, useCallback } from 'react';

import { FormattedMessage, useIntl, defineMessages } from 'react-intl';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';

import { Icon } from 'mastodon/components/icon';
import api from 'mastodon/api';

import type { WatchuNeedListing, ListingCategory } from '../types';
import { CATEGORY_LABELS } from '../types';

const messages = defineMessages({
  titlePlaceholder: { id: 'whatchuneed.title_placeholder', defaultMessage: 'What do you need?' },
  bodyPlaceholder: { id: 'whatchuneed.body_placeholder', defaultMessage: 'Describe what you\'re looking for in more detail…' },
  anyCategory: { id: 'whatchuneed.any_category', defaultMessage: 'No category' },
});

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ListingCategory[];

interface Props {
  onCreated: (listing: WatchuNeedListing) => void;
  onClose: () => void;
}

export const NewListingForm: React.FC<Props> = ({ onCreated, onClose }) => {
  const intl = useIntl();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<ListingCategory | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(() => {
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle || !trimmedBody || submitting) return;

    setSubmitting(true);
    setError(null);

    api().post('/api/v1/whatchuneed_listings', {
      listing: {
        title: trimmedTitle,
        body: trimmedBody,
        category: category !== '' ? category : null,
      },
    })
      .then(res => { onCreated(res.data as WatchuNeedListing); })
      .catch((err: { response?: { data?: { error?: string } } }) => {
        setError(err.response?.data?.error ?? 'Something went wrong');
        setSubmitting(false);
      });
  }, [title, body, category, submitting, onCreated]);

  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && !submitting;

  return (
    <div className='wtn-form-overlay'>
      <div className='wtn-form'>
        <div className='wtn-form__header'>
          <h3 className='wtn-form__title'>
            <FormattedMessage id='whatchuneed.new_listing' defaultMessage='Post a need' />
          </h3>
          <button className='wtn-form__close' onClick={onClose} type='button'>
            <Icon id='close' icon={CloseIcon} />
          </button>
        </div>

        {error !== null && <p className='wtn-form__error'>{error}</p>}

        <input
          className='wtn-form__title-input'
          type='text'
          value={title}
          onChange={e => { setTitle(e.target.value); }}
          placeholder={intl.formatMessage(messages.titlePlaceholder)}
          maxLength={240}
          autoFocus
        />

        <textarea
          className='wtn-form__body-input'
          value={body}
          onChange={e => { setBody(e.target.value); }}
          placeholder={intl.formatMessage(messages.bodyPlaceholder)}
          rows={5}
          maxLength={2000}
        />

        <select
          className='wtn-form__category-select'
          value={category}
          onChange={e => { setCategory(e.target.value as ListingCategory | ''); }}
        >
          <option value=''>{intl.formatMessage(messages.anyCategory)}</option>
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
          ))}
        </select>

        <div className='wtn-form__actions'>
          <button className='wtn-form__cancel' onClick={onClose} type='button'>
            <FormattedMessage id='whatchuneed.cancel' defaultMessage='Cancel' />
          </button>
          <button
            className='wtn-form__submit'
            onClick={handleSubmit}
            disabled={!canSubmit}
            type='button'
          >
            <FormattedMessage id='whatchuneed.post' defaultMessage='Post' />
          </button>
        </div>
      </div>
    </div>
  );
};
