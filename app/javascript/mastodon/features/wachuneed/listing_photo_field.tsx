import { useCallback, useMemo, useRef, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import AddPhotoAlternateIcon from '@/material-icons/400-24px/add_photo_alternate.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import { apiUploadListingMedia } from 'mastodon/api/wachuneed';
import type { ApiListingPhotoJSON } from 'mastodon/api_types/wachuneed';
import { Icon } from 'mastodon/components/icon';

// The photos of a listing, in a form: the listing form and the shop item
// composer both use it. Photos upload as they are picked; the first is the
// cover. When the item comes in kinds, each photo can say which it shows.

// Mirrors Listing::MAX_PHOTOS; the server drops anything past it.
const MAX_PHOTOS = 10;

// One photo in the form. `id` is the media attachment's once the upload
// has settled; until then the tile shows the local preview.
interface PhotoSlot {
  key: string;
  id: string | null;
  preview: string;
}

const messages = defineMessages({
  label: { id: 'wachuneed.new.field.photos', defaultMessage: 'Photos' },
  add: { id: 'wachuneed.new.field.photo_add', defaultMessage: 'Add photos' },
  hint: {
    id: 'wachuneed.new.field.photo_hint',
    defaultMessage:
      'Up to {max}. The first one is the cover people see in the feed.',
  },
  cover: { id: 'wachuneed.new.field.photo_cover', defaultMessage: 'Cover' },
  makeCover: {
    id: 'wachuneed.new.field.photo_make_cover',
    defaultMessage: 'Make cover',
  },
  remove: {
    id: 'wachuneed.new.field.photo_remove',
    defaultMessage: 'Remove photo',
  },
  uploading: {
    id: 'wachuneed.new.field.photo_uploading',
    defaultMessage: 'Uploading…',
  },
  error: {
    id: 'wachuneed.new.field.photo_error',
    defaultMessage: "Couldn't upload that image — try another?",
  },
  labelShows: {
    id: 'wachuneed.new.field.shows',
    defaultMessage: 'What each photo shows',
  },
  showsAny: { id: 'wachuneed.new.shows.any', defaultMessage: 'Any of them' },
  showsPhoto: {
    id: 'wachuneed.new.shows.photo',
    defaultMessage: 'Photo {number} shows',
  },
});

export interface ListingPhotosState {
  photos: PhotoSlot[];
  // Which choice each photo shows, by the photo's key in this form.
  shows: Record<string, string>;
  error: string | null;
  // Whether the owner changed them. An edit sends the photos only then, so
  // saving text never touches the ones already there.
  touched: boolean;
  uploading: boolean;
  // The uploaded photos' media ids, in order.
  ids: string[];
  // Start from a saved listing's photos, or from none.
  load: (saved: ApiListingPhotoJSON[]) => void;
  // `photo_variants` for the request: media id → the choice it shows, for
  // the choices the item still comes in.
  showsPayload: (choices: string[]) => Record<string, string>;
  handleAdd: React.ChangeEventHandler<HTMLInputElement>;
  handleRemove: React.MouseEventHandler<HTMLButtonElement>;
  handleCover: React.MouseEventHandler<HTMLButtonElement>;
  handleShows: React.ChangeEventHandler<HTMLSelectElement>;
}

export const useListingPhotos = (): ListingPhotosState => {
  const intl = useIntl();
  const [photos, setPhotos] = useState<PhotoSlot[]>([]);
  const [shows, setShows] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const nextKey = useRef(0);

  const load = useCallback((saved: ApiListingPhotoJSON[]) => {
    setPhotos(
      saved.map((photo) => ({
        key: `saved-${photo.id}`,
        id: photo.id,
        preview: photo.url,
      })),
    );
    setShows(
      Object.fromEntries(
        saved.flatMap((photo) =>
          photo.variant_value
            ? [[`saved-${photo.id}`, photo.variant_value]]
            : [],
        ),
      ),
    );
    setError(null);
    setTouched(false);
  }, []);

  const uploadError = intl.formatMessage(messages.error);
  const handleAdd = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      const room = MAX_PHOTOS - photos.length;
      const files = Array.from(e.currentTarget.files ?? []).slice(0, room);
      // Reset the input so re-selecting the same file re-triggers change.
      e.currentTarget.value = '';
      if (files.length === 0) return;

      setTouched(true);
      setError(null);

      // Each photo shows straight away from a local object-URL, and keeps
      // it: the server's own preview may still be processing.
      const slots = files.map((file) => {
        nextKey.current += 1;
        return {
          file,
          slot: {
            key: `new-${nextKey.current}`,
            id: null,
            preview: URL.createObjectURL(file),
          } satisfies PhotoSlot,
        };
      });
      setPhotos((prev) => [...prev, ...slots.map(({ slot }) => slot)]);

      slots.forEach(({ file, slot }) => {
        void (async () => {
          try {
            const uploaded = await apiUploadListingMedia(file);
            setPhotos((prev) =>
              prev.map((photo) =>
                photo.key === slot.key ? { ...photo, id: uploaded.id } : photo,
              ),
            );
          } catch {
            setPhotos((prev) => prev.filter((photo) => photo.key !== slot.key));
            setError(uploadError);
          }
        })();
      });
    },
    [photos.length, uploadError],
  );

  const handleRemove = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
    (e) => {
      const key = e.currentTarget.dataset.key;
      setTouched(true);
      setError(null);
      setPhotos((prev) => prev.filter((photo) => photo.key !== key));
    },
    [],
  );

  const handleCover = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
    (e) => {
      const key = e.currentTarget.dataset.key;
      setTouched(true);
      setPhotos((prev) => {
        const chosen = prev.find((photo) => photo.key === key);
        if (!chosen) return prev;
        return [chosen, ...prev.filter((photo) => photo.key !== key)];
      });
    },
    [],
  );

  const handleShows = useCallback<React.ChangeEventHandler<HTMLSelectElement>>(
    (e) => {
      const key = e.currentTarget.dataset.key ?? '';
      const { value } = e.currentTarget;
      setShows((prev) => ({ ...prev, [key]: value }));
      // Sent with the photos, so the photos have to be sent.
      setTouched(true);
    },
    [],
  );

  const ids = useMemo(
    () => photos.flatMap((photo) => (photo.id ? [photo.id] : [])),
    [photos],
  );

  const showsPayload = useCallback(
    (choices: string[]) =>
      Object.fromEntries(
        photos.flatMap((photo) => {
          const value = shows[photo.key];
          return photo.id && value && choices.includes(value)
            ? [[photo.id, value]]
            : [];
        }),
      ),
    [photos, shows],
  );

  return {
    photos,
    shows,
    error,
    touched,
    uploading: photos.some((photo) => photo.id === null),
    ids,
    load,
    showsPayload,
    handleAdd,
    handleRemove,
    handleCover,
    handleShows,
  };
};

export const ListingPhotoField: React.FC<{
  state: ListingPhotosState;
  // The values the item comes in ("Blue", "Large"); empty when it has no
  // kinds, and then no photo is asked what it shows.
  showsChoices: string[];
}> = ({ state, showsChoices }) => {
  const intl = useIntl();
  const { photos } = state;

  return (
    <div className='wachuneed__compose-field'>
      <span className='wachuneed__compose-label'>
        <FormattedMessage {...messages.label} />
      </span>
      <div className='wachuneed__compose-photos'>
        {photos.map((photo, index) => (
          <div key={photo.key} className='wachuneed__compose-photo'>
            <img
              src={photo.preview}
              alt=''
              className='wachuneed__compose-photo-preview'
            />
            {photo.id === null ? (
              <span className='wachuneed__compose-photo-busy'>
                <FormattedMessage {...messages.uploading} />
              </span>
            ) : (
              <>
                {index === 0 ? (
                  <span className='wachuneed__compose-photo-cover'>
                    <FormattedMessage {...messages.cover} />
                  </span>
                ) : (
                  <button
                    type='button'
                    className='wachuneed__compose-photo-cover wachuneed__compose-photo-cover--make'
                    data-key={photo.key}
                    onClick={state.handleCover}
                  >
                    <FormattedMessage {...messages.makeCover} />
                  </button>
                )}
                <button
                  type='button'
                  className='wachuneed__compose-photo-remove'
                  data-key={photo.key}
                  onClick={state.handleRemove}
                  aria-label={intl.formatMessage(messages.remove)}
                  title={intl.formatMessage(messages.remove)}
                >
                  <Icon id='close' icon={CloseIcon} />
                </button>
              </>
            )}
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <label className='wachuneed__compose-photo-pick'>
            <input
              type='file'
              accept='image/*'
              multiple
              onChange={state.handleAdd}
              className='wachuneed__compose-photo-input'
            />
            <Icon id='add_photo_alternate' icon={AddPhotoAlternateIcon} />
            <span>
              <FormattedMessage {...messages.add} />
            </span>
          </label>
        )}
      </div>
      <p className='wachuneed__compose-hint'>
        <FormattedMessage {...messages.hint} values={{ max: MAX_PHOTOS }} />
      </p>
      {state.error && <p className='wachuneed__compose-error'>{state.error}</p>}
      {showsChoices.length > 0 && photos.some((photo) => photo.id !== null) && (
        <>
          <span className='wachuneed__compose-label'>
            <FormattedMessage {...messages.labelShows} />
          </span>
          <ul className='wachuneed__compose-shows'>
            {photos.map((photo, index) =>
              photo.id === null ? null : (
                <li key={photo.key}>
                  <img src={photo.preview} alt='' />
                  <select
                    className='wachuneed__compose-input'
                    value={state.shows[photo.key] ?? ''}
                    data-key={photo.key}
                    onChange={state.handleShows}
                    aria-label={intl.formatMessage(messages.showsPhoto, {
                      number: index + 1,
                    })}
                  >
                    <option value=''>
                      {intl.formatMessage(messages.showsAny)}
                    </option>
                    {showsChoices.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </li>
              ),
            )}
          </ul>
        </>
      )}
    </div>
  );
};
