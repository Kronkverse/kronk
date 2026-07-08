import { useCallback, useEffect, useRef, useState } from 'react';

import { FormattedMessage, defineMessages, useIntl } from 'react-intl';

import { useHistory, useLocation } from 'react-router-dom';

import AddPhotoIcon from '@/material-icons/400-24px/add_photo_alternate.svg?react';
import ArrowBackIcon from '@/material-icons/400-24px/arrow_back.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import api from 'mastodon/api';

import type {
  MarketplaceCategory,
  MarketplaceListing,
  MarketplaceMediaAttachment,
} from '../types';

const MAX_PHOTOS = 4;
const ACCEPTED_IMAGE_TYPES =
  'image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,image/avif';

type PhotoStatus = 'uploading' | 'done' | 'failed';

interface PhotoUpload {
  localId: string;
  previewUrl: string;
  mediaId: string | null;
  status: PhotoStatus;
}

const messages = defineMessages({
  title: { id: 'marketplace.compose.title', defaultMessage: 'Title' },
  titlePlaceholder: {
    id: 'marketplace.compose.title_placeholder',
    defaultMessage: 'What are you sharing?',
  },
  description: {
    id: 'marketplace.compose.description',
    defaultMessage: 'Description',
  },
  descriptionPlaceholder: {
    id: 'marketplace.compose.description_placeholder',
    defaultMessage: 'Tell people about it.',
  },
  subcategory: {
    id: 'marketplace.compose.subcategory',
    defaultMessage: 'Category (optional)',
  },
  subcategoryPlaceholder: {
    id: 'marketplace.compose.subcategory_placeholder',
    defaultMessage: 'e.g. music, handmade, healing',
  },
  price: {
    id: 'marketplace.compose.price',
    defaultMessage: 'Price / rate',
  },
  pricePlaceholder: {
    id: 'marketplace.compose.price_placeholder',
    defaultMessage: '$50, koha, trade, $80 / session…',
  },
  location: {
    id: 'marketplace.compose.location',
    defaultMessage: 'Location (optional)',
  },
  locationPlaceholder: {
    id: 'marketplace.compose.location_placeholder',
    defaultMessage: 'e.g. Sydney, AU',
  },
  photos: {
    id: 'marketplace.compose.photos',
    defaultMessage: 'Photos (optional)',
  },
  addPhotos: {
    id: 'marketplace.compose.add_photos',
    defaultMessage: 'Add photos',
  },
  photosHint: {
    id: 'marketplace.compose.photos_hint',
    defaultMessage: 'Up to {max} photos.',
  },
  removePhoto: {
    id: 'marketplace.compose.remove_photo',
    defaultMessage: 'Remove photo',
  },
  photoUploading: {
    id: 'marketplace.compose.photo_uploading',
    defaultMessage: 'Uploading…',
  },
  photoFailed: {
    id: 'marketplace.compose.photo_failed',
    defaultMessage: 'Upload failed',
  },
});

const CATEGORY_OPTIONS: {
  value: MarketplaceCategory;
  label: React.ReactNode;
  desc: React.ReactNode;
  variant: 'creation' | 'market' | 'service';
}[] = [
  {
    value: 'creation',
    label: (
      <FormattedMessage
        id='marketplace.door.creations.title'
        defaultMessage='Creations'
      />
    ),
    desc: (
      <FormattedMessage
        id='marketplace.compose.creation_hint'
        defaultMessage='Art, music, handmade, photography'
      />
    ),
    variant: 'creation',
  },
  {
    value: 'marketplace',
    label: (
      <FormattedMessage
        id='marketplace.door.marketplace.title'
        defaultMessage='Marketplace'
      />
    ),
    desc: (
      <FormattedMessage
        id='marketplace.compose.marketplace_hint'
        defaultMessage='Goods and items for sale or trade'
      />
    ),
    variant: 'market',
  },
  {
    value: 'service',
    label: (
      <FormattedMessage
        id='marketplace.door.services.title'
        defaultMessage='Services'
      />
    ),
    desc: (
      <FormattedMessage
        id='marketplace.compose.service_hint'
        defaultMessage='Offerings, sessions, expertise'
      />
    ),
    variant: 'service',
  },
];

const REDIRECT_AFTER: Record<MarketplaceCategory, string> = {
  creation: '/marketplace/creations',
  marketplace: '/marketplace/marketplace',
  service: '/marketplace/services',
};

const parseInitialCategory = (
  search: string,
): MarketplaceCategory | undefined => {
  const params = new URLSearchParams(search);
  const raw = params.get('section');
  if (raw === 'creations' || raw === 'creation') return 'creation';
  if (raw === 'marketplace') return 'marketplace';
  if (raw === 'services' || raw === 'service') return 'service';
  return undefined;
};

export const ComposeForm: React.FC = () => {
  const intl = useIntl();
  const history = useHistory();
  const location = useLocation();

  const [category, setCategory] = useState<MarketplaceCategory>(
    parseInitialCategory(location.search) ?? 'creation',
  );
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [price, setPrice] = useState('');
  const [locationText, setLocationText] = useState('');
  const [photos, setPhotos] = useState<PhotoUpload[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploading = photos.some((p) => p.status === 'uploading');

  const canSubmit = title.trim().length > 0 && !submitting && !uploading;

  // Revoke any live blob URLs on unmount so the browser can free them.
  useEffect(() => {
    return () => {
      setPhotos((prev) => {
        prev.forEach((p) => {
          URL.revokeObjectURL(p.previewUrl);
        });
        return prev;
      });
    };
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = '';
      if (files.length === 0) return;

      setPhotos((prev) => {
        const remaining = MAX_PHOTOS - prev.length;
        const toUpload = files.slice(0, remaining);

        const newUploads: PhotoUpload[] = toUpload.map((file) => ({
          localId: `${Date.now().toString()}-${Math.random().toString(36).slice(2)}`,
          previewUrl: URL.createObjectURL(file),
          mediaId: null,
          status: 'uploading',
        }));

        toUpload.forEach((file, i) => {
          const upload = newUploads[i];
          if (!upload) return;

          const fd = new FormData();
          fd.append('file', file);

          api()
            .post<MarketplaceMediaAttachment>('/api/v1/media', fd)
            .then((res) => {
              setPhotos((current) =>
                current.map((p) =>
                  p.localId === upload.localId
                    ? { ...p, mediaId: res.data.id, status: 'done' }
                    : p,
                ),
              );
            })
            .catch(() => {
              setPhotos((current) =>
                current.map((p) =>
                  p.localId === upload.localId
                    ? { ...p, status: 'failed' }
                    : p,
                ),
              );
            });
        });

        return [...prev, ...newUploads];
      });
    },
    [],
  );

  const handleRemovePhoto = useCallback((localId: string) => {
    setPhotos((prev) => {
      const removed = prev.find((p) => p.localId === localId);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((p) => p.localId !== localId);
    });
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;
      setSubmitting(true);
      setError(null);
      try {
        const body: Record<string, string | string[]> = {
          title: title.trim(),
          description: description.trim(),
          category,
        };
        if (subcategory.trim()) body.subcategory = subcategory.trim();
        if (price.trim()) body.price_display = price.trim();
        if (locationText.trim()) body.location = locationText.trim();

        const mediaIds = photos
          .filter((p) => p.status === 'done' && p.mediaId)
          .map((p) => p.mediaId as string);
        if (mediaIds.length > 0) body.media_ids = mediaIds;

        await api().post<MarketplaceListing>(
          '/api/v1/marketplace/listings',
          body,
        );
        history.push(REDIRECT_AFTER[category]);
      } catch (err) {
        console.error('Failed to create listing:', err);
        setError(
          intl.formatMessage({
            id: 'marketplace.compose.error',
            defaultMessage:
              'Something went wrong — check the fields and try again.',
          }),
        );
      } finally {
        setSubmitting(false);
      }
    },
    [
      canSubmit,
      title,
      description,
      subcategory,
      price,
      locationText,
      category,
      photos,
      history,
      intl,
    ],
  );

  const backLabel = intl.formatMessage({
    id: 'marketplace.compose.back',
    defaultMessage: 'Back to Marketplace',
  });

  return (
    <div className={`marketplace-compose marketplace-compose--${category}`}>
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

      <header className='marketplace-compose__header'>
        <p className='marketplace-eyebrow'>
          <FormattedMessage
            id='marketplace.compose.eyebrow'
            defaultMessage='Share'
          />
        </p>
        <h2 className='marketplace-compose__heading'>
          <FormattedMessage
            id='marketplace.compose.heading'
            defaultMessage='Add a listing'
          />
        </h2>
      </header>

      <form className='marketplace-compose__form' onSubmit={handleSubmit}>
        <fieldset className='marketplace-compose__section'>
          <legend className='marketplace-eyebrow marketplace-compose__legend'>
            <FormattedMessage
              id='marketplace.compose.category_legend'
              defaultMessage='Which threshold?'
            />
          </legend>
          <div className='marketplace-compose__categories'>
            {CATEGORY_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={
                  'marketplace-compose__category-option' +
                  (category === opt.value
                    ? ' marketplace-compose__category-option--active'
                    : '') +
                  ` marketplace-compose__category-option--${opt.variant}`
                }
              >
                <input
                  type='radio'
                  name='category'
                  value={opt.value}
                  checked={category === opt.value}
                  onChange={() => {
                    setCategory(opt.value);
                  }}
                />
                <span className='marketplace-compose__category-title'>
                  {opt.label}
                </span>
                <span className='marketplace-compose__category-desc'>
                  {opt.desc}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className='marketplace-compose__field'>
          <span className='marketplace-eyebrow marketplace-compose__label'>
            {intl.formatMessage(messages.title)}
          </span>
          <input
            type='text'
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
            }}
            maxLength={200}
            placeholder={intl.formatMessage(messages.titlePlaceholder)}
            required
          />
        </label>

        <label className='marketplace-compose__field'>
          <span className='marketplace-eyebrow marketplace-compose__label'>
            {intl.formatMessage(messages.description)}
          </span>
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
            }}
            maxLength={5000}
            rows={5}
            placeholder={intl.formatMessage(messages.descriptionPlaceholder)}
          />
        </label>

        <div className='marketplace-compose__row'>
          <label className='marketplace-compose__field'>
            <span className='marketplace-eyebrow marketplace-compose__label'>
              {intl.formatMessage(messages.price)}
            </span>
            <input
              type='text'
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
              }}
              maxLength={100}
              placeholder={intl.formatMessage(messages.pricePlaceholder)}
            />
          </label>

          <label className='marketplace-compose__field'>
            <span className='marketplace-eyebrow marketplace-compose__label'>
              {intl.formatMessage(messages.location)}
            </span>
            <input
              type='text'
              value={locationText}
              onChange={(e) => {
                setLocationText(e.target.value);
              }}
              maxLength={200}
              placeholder={intl.formatMessage(messages.locationPlaceholder)}
            />
          </label>
        </div>

        <label className='marketplace-compose__field'>
          <span className='marketplace-eyebrow marketplace-compose__label'>
            {intl.formatMessage(messages.subcategory)}
          </span>
          <input
            type='text'
            value={subcategory}
            onChange={(e) => {
              setSubcategory(e.target.value);
            }}
            maxLength={64}
            placeholder={intl.formatMessage(messages.subcategoryPlaceholder)}
          />
        </label>

        <fieldset className='marketplace-compose__section marketplace-compose__photos'>
          <legend className='marketplace-eyebrow marketplace-compose__legend'>
            {intl.formatMessage(messages.photos)}
          </legend>
          <p className='marketplace-compose__photos-hint'>
            {intl.formatMessage(messages.photosHint, { max: MAX_PHOTOS })}
          </p>

          <div className='marketplace-compose__photo-grid'>
            {photos.map((photo) => (
              <div
                key={photo.localId}
                className={`marketplace-compose__photo marketplace-compose__photo--${photo.status}`}
              >
                <img
                  src={photo.previewUrl}
                  alt=''
                  className='marketplace-compose__photo-image'
                />
                {photo.status === 'uploading' && (
                  <span className='marketplace-compose__photo-state'>
                    {intl.formatMessage(messages.photoUploading)}
                  </span>
                )}
                {photo.status === 'failed' && (
                  <span className='marketplace-compose__photo-state marketplace-compose__photo-state--failed'>
                    {intl.formatMessage(messages.photoFailed)}
                  </span>
                )}
                <button
                  type='button'
                  className='marketplace-compose__photo-remove'
                  aria-label={intl.formatMessage(messages.removePhoto)}
                  onClick={() => {
                    handleRemovePhoto(photo.localId);
                  }}
                >
                  <CloseIcon width={14} height={14} />
                </button>
              </div>
            ))}

            {photos.length < MAX_PHOTOS && (
              <button
                type='button'
                className='marketplace-compose__photo-add'
                onClick={() => fileInputRef.current?.click()}
              >
                <AddPhotoIcon width={20} height={20} />
                <span>{intl.formatMessage(messages.addPhotos)}</span>
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type='file'
            accept={ACCEPTED_IMAGE_TYPES}
            multiple
            hidden
            onChange={handleFileSelect}
          />
        </fieldset>

        {error && <p className='marketplace-compose__error'>{error}</p>}

        <div className='marketplace-compose__actions'>
          <button
            type='button'
            className='marketplace-compose__cancel'
            onClick={() => {
              history.push('/marketplace');
            }}
          >
            <FormattedMessage
              id='marketplace.compose.cancel'
              defaultMessage='Cancel'
            />
          </button>
          <button
            type='submit'
            className='marketplace-compose__submit'
            disabled={!canSubmit}
          >
            {submitting ? (
              <FormattedMessage
                id='marketplace.compose.submitting'
                defaultMessage='Sharing…'
              />
            ) : (
              <FormattedMessage
                id='marketplace.compose.submit'
                defaultMessage='Share listing'
              />
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
