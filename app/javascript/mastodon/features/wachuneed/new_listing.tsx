import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { useHistory, useLocation, useParams } from 'react-router-dom';

import {
  apiCreateWachuneedListing,
  apiGetWachuneedListing,
  apiUpdateWachuneedListing,
  apiUploadListingMedia,
} from 'mastodon/api/wachuneed';
import type { CreateListingParams } from 'mastodon/api/wachuneed';
import { Stage } from 'mastodon/components/stage';

// /hub/wachuneed/new — the composer for a new listing, on offer or
// wanted (Wachumissing); `?kind=wanted` opens on wanted.
// /hub/wachuneed/listings/:id/edit — the same form, prefilled, for the
// listing's owner (the server refuses anyone else).
//
// Kept intentionally simple in this pass: title + description +
// category picker + optional price + optional location. Photos and
// the 5 interaction modes (buy_now, buy_or_bargain, book_service,
// contact_to_discuss, workshop_join) are follow-ups — this composer
// only produces a listing in the `live` state so it lands in the
// browse view immediately.

type Category = 'creation' | 'goods' | 'service';
type Kind = 'offer' | 'wanted';

const messages = defineMessages({
  title: { id: 'wachuneed.new.title', defaultMessage: 'New listing' },
  intro: {
    id: 'wachuneed.new.intro',
    defaultMessage:
      'Share something you make, something you have, or something you offer. Kronkers can find it in the browse view and message you to arrange the exchange.',
  },
  introWanted: {
    id: 'wachuneed.new.intro_wanted',
    defaultMessage:
      "Say what you're looking for. It shows in Wachumissing, and anyone who has it can message you.",
  },
  labelKind: {
    id: 'wachuneed.new.field.kind',
    defaultMessage: 'What are you posting?',
  },
  kindOffer: {
    id: 'wachuneed.new.kind.offer',
    defaultMessage: "Something I'm offering",
  },
  kindWanted: {
    id: 'wachuneed.new.kind.wanted',
    defaultMessage: "Something I'm looking for",
  },
  labelBudget: {
    id: 'wachuneed.new.field.budget',
    defaultMessage: 'Budget (in AUD)',
  },
  placeholderBudget: {
    id: 'wachuneed.new.field.budget_placeholder',
    defaultMessage: 'Optional — what you could pay',
  },
  labelTitle: { id: 'wachuneed.new.field.title', defaultMessage: 'Title' },
  placeholderTitle: {
    id: 'wachuneed.new.field.title_placeholder',
    defaultMessage: 'A short name — what is it?',
  },
  labelDescription: {
    id: 'wachuneed.new.field.description',
    defaultMessage: 'Description',
  },
  placeholderDescription: {
    id: 'wachuneed.new.field.description_placeholder',
    defaultMessage:
      'Detail — materials, size, timing, anything a buyer needs to know.',
  },
  labelCategory: {
    id: 'wachuneed.new.field.category',
    defaultMessage: 'Category',
  },
  categoryArt: {
    id: 'wachuneed.new.category.art',
    defaultMessage: 'Art — things you make',
  },
  categoryStuff: {
    id: 'wachuneed.new.category.stuff',
    defaultMessage: 'Stuff — things you have',
  },
  categoryOfferings: {
    id: 'wachuneed.new.category.offerings',
    defaultMessage: 'Offerings — services you provide',
  },
  labelPrice: {
    id: 'wachuneed.new.field.price',
    defaultMessage: 'Price (in AUD)',
  },
  labelPhoto: {
    id: 'wachuneed.new.field.photo',
    defaultMessage: 'Photo',
  },
  photoChoose: {
    id: 'wachuneed.new.field.photo_choose',
    defaultMessage: 'Choose an image',
  },
  photoReplace: {
    id: 'wachuneed.new.field.photo_replace',
    defaultMessage: 'Replace image',
  },
  photoRemove: {
    id: 'wachuneed.new.field.photo_remove',
    defaultMessage: 'Remove',
  },
  photoUploading: {
    id: 'wachuneed.new.field.photo_uploading',
    defaultMessage: 'Uploading…',
  },
  photoErrorGeneric: {
    id: 'wachuneed.new.field.photo_error',
    defaultMessage: "Couldn't upload that image — try another?",
  },
  placeholderPrice: {
    id: 'wachuneed.new.field.price_placeholder',
    defaultMessage: 'Leave blank if free or by arrangement',
  },
  labelLocation: {
    id: 'wachuneed.new.field.location',
    defaultMessage: 'Location',
  },
  placeholderLocation: {
    id: 'wachuneed.new.field.location_placeholder',
    defaultMessage: 'City / remote / by post — how does the exchange happen?',
  },
  submit: { id: 'wachuneed.new.submit', defaultMessage: 'Publish listing' },
  submitting: {
    id: 'wachuneed.new.submitting',
    defaultMessage: 'Publishing…',
  },
  errorGeneric: {
    id: 'wachuneed.new.error',
    defaultMessage: "Couldn't publish the listing. Try again?",
  },
  editTitle: { id: 'wachuneed.edit.title', defaultMessage: 'Edit listing' },
  editLoading: {
    id: 'wachuneed.edit.loading',
    defaultMessage: 'Loading listing…',
  },
  editLoadError: {
    id: 'wachuneed.edit.load_error',
    defaultMessage: "Couldn't load this listing.",
  },
  save: { id: 'wachuneed.edit.save', defaultMessage: 'Save changes' },
  saving: { id: 'wachuneed.edit.saving', defaultMessage: 'Saving…' },
  saveError: {
    id: 'wachuneed.edit.error',
    defaultMessage: "Couldn't save your changes. Try again?",
  },
});

const KIND_OPTIONS: { key: Kind; label: typeof messages.kindOffer }[] = [
  { key: 'offer', label: messages.kindOffer },
  { key: 'wanted', label: messages.kindWanted },
];

const CATEGORY_OPTIONS: {
  key: Category;
  label: typeof messages.categoryArt;
}[] = [
  { key: 'creation', label: messages.categoryArt },
  { key: 'goods', label: messages.categoryStuff },
  { key: 'service', label: messages.categoryOfferings },
];

const WachuneedNew: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const history = useHistory();
  const { id: editId } = useParams<{ id?: string }>();
  const { search } = useLocation();
  const editing = !!editId;

  // `/hub/wachuneed/new?kind=wanted` opens straight on "looking for".
  const [kind, setKind] = useState<Kind>(() =>
    new URLSearchParams(search).get('kind') === 'wanted' ? 'wanted' : 'offer',
  );

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
  // Editing: the photo is only sent when the owner changed or removed
  // it, so saving text edits never drops the existing photo.
  const [photoTouched, setPhotoTouched] = useState(false);
  const [loadingListing, setLoadingListing] = useState(editing);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    apiGetWachuneedListing(editId)
      .then((listing) => {
        if (cancelled) return;
        setTitle(listing.title);
        setKind(listing.kind === 'wanted' ? 'wanted' : 'offer');
        setDescription(listing.description ?? '');
        if (
          listing.category === 'creation' ||
          listing.category === 'goods' ||
          listing.category === 'service'
        ) {
          setCategory(listing.category);
        }
        setPrice(
          typeof listing.price_cents === 'number'
            ? (listing.price_cents / 100).toFixed(2)
            : '',
        );
        setLocation(listing.location ?? '');
        setPhotoPreview(listing.photo_url ?? null);
        setLoadingListing(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        setLoadingListing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editId]);

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
      setPhotoTouched(true);
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
    setPhotoTouched(true);
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

  const handleKindChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setKind(e.currentTarget.value as Kind);
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
        kind,
        location: location.trim() || undefined,
        state: 'live',
        ...(priceCents !== null && Number.isFinite(priceCents)
          ? { price_cents: priceCents, price_currency: 'AUD' }
          : { price_cents: null }),
        ...(photoId ? { media_attachment_ids: [photoId] } : {}),
      };

      void (async () => {
        try {
          if (editId) {
            // Keep the listing's state; send the photo only if it changed.
            const edit: Partial<CreateListingParams> = { ...payload };
            delete edit.state;
            delete edit.media_attachment_ids;
            await apiUpdateWachuneedListing(editId, {
              ...edit,
              ...(photoTouched
                ? { media_attachment_ids: photoId ? [photoId] : [] }
                : {}),
            });
            history.push(`/hub/wachuneed/listings/${editId}`);
            return;
          }
          await apiCreateWachuneedListing(payload);
          // Land on the user's own listings so they see it immediately.
          history.push('/hub/wachuneed/wachugot');
        } catch (err: unknown) {
          setError(
            err instanceof Error
              ? err.message
              : intl.formatMessage(
                  editId ? messages.saveError : messages.errorGeneric,
                ),
          );
          setSubmitting(false);
        }
      })();
    },
    [
      editId,
      photoTouched,
      canSubmit,
      title,
      description,
      category,
      kind,
      price,
      location,
      photoId,
      history,
      intl,
    ],
  );

  if (editing && (loadingListing || loadError)) {
    return (
      <Stage label={intl.formatMessage(messages.editTitle)}>
        <div className='scrollable wachuneed wachuneed--compose'>
          <p className='wachuneed__status'>
            {intl.formatMessage(
              loadError ? messages.editLoadError : messages.editLoading,
            )}
          </p>
        </div>
      </Stage>
    );
  }

  return (
    <Stage
      label={intl.formatMessage(editing ? messages.editTitle : messages.title)}
    >
      <div className='scrollable wachuneed wachuneed--compose'>
        {/* Hand-rolled "← Cancel" back link removed 2026-09-03 —
            Frame's SpaceBadge carries the back-to-korner nav.
            Bespoke back links are banned platform-wide; see
            docs/design.md (Aesthetic system) § Navigation. */}

        {!editing && (
          <p className='wachuneed__compose-intro'>
            <FormattedMessage
              {...(kind === 'wanted' ? messages.introWanted : messages.intro)}
            />
          </p>
        )}

        <form className='wachuneed__compose-form' onSubmit={handleSubmit}>
          <fieldset className='wachuneed__compose-field'>
            <legend className='wachuneed__compose-label'>
              <FormattedMessage {...messages.labelKind} />
            </legend>
            <div className='wachuneed__compose-radio-group'>
              {KIND_OPTIONS.map((opt) => (
                <label
                  key={opt.key}
                  className={`wachuneed__compose-radio ${kind === opt.key ? 'wachuneed__compose-radio--active' : ''}`}
                >
                  <input
                    type='radio'
                    name='kind'
                    value={opt.key}
                    checked={kind === opt.key}
                    onChange={handleKindChange}
                  />
                  <span>{intl.formatMessage(opt.label)}</span>
                </label>
              ))}
            </div>
          </fieldset>

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
              <FormattedMessage
                {...(kind === 'wanted'
                  ? messages.labelBudget
                  : messages.labelPrice)}
              />
            </span>
            <input
              type='number'
              min={0}
              step={0.01}
              className='wachuneed__compose-input'
              value={price}
              onChange={handlePriceChange}
              placeholder={intl.formatMessage(
                kind === 'wanted'
                  ? messages.placeholderBudget
                  : messages.placeholderPrice,
              )}
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
            {intl.formatMessage(
              editing
                ? submitting
                  ? messages.saving
                  : messages.save
                : submitting
                  ? messages.submitting
                  : messages.submit,
            )}
          </button>
        </form>
      </div>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default WachuneedNew;
