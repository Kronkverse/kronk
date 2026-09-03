import { useCallback, useMemo, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { useHistory } from 'react-router-dom';

import {
  apiCreateMartketplaceListing,
  apiUploadListingMedia,
} from 'mastodon/api/martketplace';
import type { CreateListingParams } from 'mastodon/api/martketplace';
import { Stage } from 'mastodon/components/stage';

// /hub/martketplace/new — the composer for a new listing.
//
// Kept intentionally simple in this pass: title + description +
// category picker + optional price + optional location. Photos and
// the 5 interaction modes (buy_now, buy_or_bargain, book_service,
// contact_to_discuss, workshop_join) are follow-ups — this composer
// only produces a listing in the `live` state so it lands in the
// browse view immediately.

type Category = 'creation' | 'goods' | 'service';

const messages = defineMessages({
  title: { id: 'martketplace.new.title', defaultMessage: 'New listing' },
  intro: {
    id: 'martketplace.new.intro',
    defaultMessage:
      'Share something you make, something you have, or something you offer. Kronkers can find it in the browse view and message you to arrange the exchange.',
  },
  labelTitle: { id: 'martketplace.new.field.title', defaultMessage: 'Title' },
  placeholderTitle: {
    id: 'martketplace.new.field.title_placeholder',
    defaultMessage: 'A short name — what is it?',
  },
  labelDescription: {
    id: 'martketplace.new.field.description',
    defaultMessage: 'Description',
  },
  placeholderDescription: {
    id: 'martketplace.new.field.description_placeholder',
    defaultMessage:
      'Detail — materials, size, timing, anything a buyer needs to know.',
  },
  labelCategory: {
    id: 'martketplace.new.field.category',
    defaultMessage: 'Category',
  },
  categoryArt: {
    id: 'martketplace.new.category.art',
    defaultMessage: 'Art — things you make',
  },
  categoryStuff: {
    id: 'martketplace.new.category.stuff',
    defaultMessage: 'Stuff — things you have',
  },
  categoryOfferings: {
    id: 'martketplace.new.category.offerings',
    defaultMessage: 'Offerings — services you provide',
  },
  labelPrice: {
    id: 'martketplace.new.field.price',
    defaultMessage: 'Price (in AUD)',
  },
  labelPhoto: {
    id: 'martketplace.new.field.photo',
    defaultMessage: 'Photo',
  },
  photoChoose: {
    id: 'martketplace.new.field.photo_choose',
    defaultMessage: 'Choose an image',
  },
  photoReplace: {
    id: 'martketplace.new.field.photo_replace',
    defaultMessage: 'Replace image',
  },
  photoRemove: {
    id: 'martketplace.new.field.photo_remove',
    defaultMessage: 'Remove',
  },
  photoUploading: {
    id: 'martketplace.new.field.photo_uploading',
    defaultMessage: 'Uploading…',
  },
  photoErrorGeneric: {
    id: 'martketplace.new.field.photo_error',
    defaultMessage: "Couldn't upload that image — try another?",
  },
  placeholderPrice: {
    id: 'martketplace.new.field.price_placeholder',
    defaultMessage: 'Leave blank if free or by arrangement',
  },
  labelLocation: {
    id: 'martketplace.new.field.location',
    defaultMessage: 'Location',
  },
  placeholderLocation: {
    id: 'martketplace.new.field.location_placeholder',
    defaultMessage: 'City / remote / by post — how does the exchange happen?',
  },
  submit: { id: 'martketplace.new.submit', defaultMessage: 'Publish listing' },
  submitting: {
    id: 'martketplace.new.submitting',
    defaultMessage: 'Publishing…',
  },
  errorGeneric: {
    id: 'martketplace.new.error',
    defaultMessage: "Couldn't publish the listing. Try again?",
  },
});

const CATEGORY_OPTIONS: {
  key: Category;
  label: typeof messages.categoryArt;
}[] = [
  { key: 'creation', label: messages.categoryArt },
  { key: 'goods', label: messages.categoryStuff },
  { key: 'service', label: messages.categoryOfferings },
];

const MartketplaceNew: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const history = useHistory();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('creation');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One photo, one attachment id — the listing schema supports many
  // but the composer only surfaces one slot for now to keep the flow
  // simple. Ordering / additional photos are a follow-up.
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => title.trim().length > 0 && !submitting && !photoUploading,
    [title, submitting, photoUploading],
  );

  const handlePhotoChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >(
    (e) => {
      const file = e.currentTarget.files?.[0];
      // Reset the input so re-selecting the same file re-triggers change.
      e.currentTarget.value = '';
      if (!file) return;

      // Show an immediate local preview via object-URL; swap to the
      // server-authoritative preview_url once the upload settles.
      const localPreview = URL.createObjectURL(file);
      setPhotoPreview(localPreview);
      setPhotoUploading(true);
      setPhotoError(null);

      void (async () => {
        try {
          const uploaded = await apiUploadListingMedia(file);
          setPhotoId(uploaded.id);
          if (uploaded.preview_url) setPhotoPreview(uploaded.preview_url);
        } catch {
          setPhotoId(null);
          setPhotoPreview(null);
          setPhotoError(intl.formatMessage(messages.photoErrorGeneric));
        } finally {
          setPhotoUploading(false);
        }
      })();
    },
    [intl],
  );

  const handlePhotoRemove = useCallback(() => {
    setPhotoId(null);
    setPhotoPreview(null);
    setPhotoError(null);
  }, []);

  const handleTitleChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setTitle(e.currentTarget.value);
  }, []);

  const handleDescriptionChange = useCallback<
    React.ChangeEventHandler<HTMLTextAreaElement>
  >((e) => {
    setDescription(e.currentTarget.value);
  }, []);

  const handleCategoryChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setCategory(e.currentTarget.value as Category);
  }, []);

  const handlePriceChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setPrice(e.currentTarget.value);
  }, []);

  const handleLocationChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setLocation(e.currentTarget.value);
  }, []);

  const handleSubmit = useCallback<React.FormEventHandler<HTMLFormElement>>(
    (e) => {
      e.preventDefault();
      if (!canSubmit) return;
      setSubmitting(true);
      setError(null);

      const parsedPrice = price.trim();
      const priceCents = parsedPrice
        ? Math.round(parseFloat(parsedPrice) * 100)
        : null;

      const payload: CreateListingParams = {
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        location: location.trim() || undefined,
        state: 'live',
        ...(priceCents !== null && Number.isFinite(priceCents)
          ? { price_cents: priceCents, price_currency: 'AUD' }
          : { price_cents: null }),
        ...(photoId ? { media_attachment_ids: [photoId] } : {}),
      };

      void (async () => {
        try {
          await apiCreateMartketplaceListing(payload);
          // Land on the user's own listings so they see it immediately.
          history.push('/hub/martketplace/wachugot');
        } catch (err: unknown) {
          setError(
            err instanceof Error
              ? err.message
              : intl.formatMessage(messages.errorGeneric),
          );
          setSubmitting(false);
        }
      })();
    },
    [
      canSubmit,
      title,
      description,
      category,
      price,
      location,
      photoId,
      history,
      intl,
    ],
  );

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <div className='scrollable wachuneed wachuneed--compose'>
        {/* Hand-rolled "← Cancel" back link removed 2026-09-03 —
            Frame's SpaceBadge carries the back-to-korner nav.
            Bespoke back links are banned platform-wide; see
            docs/kronk_aesthetic_system.md § Navigation. */}

        <p className='wachuneed__compose-intro'>
          <FormattedMessage {...messages.intro} />
        </p>

        <form className='wachuneed__compose-form' onSubmit={handleSubmit}>
          <label className='wachuneed__compose-field'>
            <span className='wachuneed__compose-label'>
              <FormattedMessage {...messages.labelTitle} />
            </span>
            <input
              type='text'
              className='wachuneed__compose-input'
              value={title}
              onChange={handleTitleChange}
              placeholder={intl.formatMessage(messages.placeholderTitle)}
              required
              maxLength={200}
            />
          </label>

          <label className='wachuneed__compose-field'>
            <span className='wachuneed__compose-label'>
              <FormattedMessage {...messages.labelDescription} />
            </span>
            <textarea
              className='wachuneed__compose-textarea'
              value={description}
              onChange={handleDescriptionChange}
              placeholder={intl.formatMessage(messages.placeholderDescription)}
              rows={4}
            />
          </label>

          <fieldset className='wachuneed__compose-field'>
            <legend className='wachuneed__compose-label'>
              <FormattedMessage {...messages.labelCategory} />
            </legend>
            <div className='wachuneed__compose-radio-group'>
              {CATEGORY_OPTIONS.map((opt) => (
                <label
                  key={opt.key}
                  className={`wachuneed__compose-radio ${category === opt.key ? 'wachuneed__compose-radio--active' : ''}`}
                >
                  <input
                    type='radio'
                    name='category'
                    value={opt.key}
                    checked={category === opt.key}
                    onChange={handleCategoryChange}
                  />
                  <span>{intl.formatMessage(opt.label)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className='wachuneed__compose-field'>
            <span className='wachuneed__compose-label'>
              <FormattedMessage {...messages.labelPrice} />
            </span>
            <input
              type='number'
              min={0}
              step={0.01}
              className='wachuneed__compose-input'
              value={price}
              onChange={handlePriceChange}
              placeholder={intl.formatMessage(messages.placeholderPrice)}
            />
          </label>

          <label className='wachuneed__compose-field'>
            <span className='wachuneed__compose-label'>
              <FormattedMessage {...messages.labelLocation} />
            </span>
            <input
              type='text'
              className='wachuneed__compose-input'
              value={location}
              onChange={handleLocationChange}
              placeholder={intl.formatMessage(messages.placeholderLocation)}
            />
          </label>

          <div className='wachuneed__compose-field'>
            <span className='wachuneed__compose-label'>
              <FormattedMessage {...messages.labelPhoto} />
            </span>
            <div className='wachuneed__compose-photo'>
              {photoPreview && (
                <img
                  src={photoPreview}
                  alt=''
                  className='wachuneed__compose-photo-preview'
                />
              )}
              <label className='wachuneed__compose-photo-pick'>
                <input
                  type='file'
                  accept='image/*'
                  onChange={handlePhotoChange}
                  className='wachuneed__compose-photo-input'
                />
                <span>
                  {photoUploading ? (
                    <FormattedMessage {...messages.photoUploading} />
                  ) : photoPreview ? (
                    <FormattedMessage {...messages.photoReplace} />
                  ) : (
                    <FormattedMessage {...messages.photoChoose} />
                  )}
                </span>
              </label>
              {photoPreview && !photoUploading && (
                <button
                  type='button'
                  className='wachuneed__compose-photo-remove'
                  onClick={handlePhotoRemove}
                >
                  <FormattedMessage {...messages.photoRemove} />
                </button>
              )}
            </div>
            {photoError && (
              <p className='wachuneed__compose-error'>{photoError}</p>
            )}
          </div>

          {error && <p className='wachuneed__compose-error'>{error}</p>}

          <button
            type='submit'
            className='wachuneed__compose-submit'
            disabled={!canSubmit}
          >
            {submitting
              ? intl.formatMessage(messages.submitting)
              : intl.formatMessage(messages.submit)}
          </button>
        </form>
      </div>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default MartketplaceNew;
