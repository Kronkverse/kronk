import { useState, useCallback, useRef } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { closeModal } from 'mastodon/actions/modal';
import { apiAddMediaTag } from 'mastodon/api/media_tags';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

const messages = defineMessages({
  title: { id: 'self_tag.title', defaultMessage: 'Tag yourself' },
  clickToPlace: {
    id: 'self_tag.click_to_place',
    defaultMessage: 'Click the image to place your tag',
  },
});

export const SelfTagModal: React.FC<{
  mediaId: string;
  previewUrl: string;
}> = ({ mediaId, previewUrl }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const myId = useAppSelector((state) => state.meta.get('me') as string);
  const imgRef = useRef<HTMLDivElement>(null);
  const [pin, setPin] = useState<{ x: number; y: number }>({
    x: 0.5,
    y: 0.5,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => {
    dispatch(closeModal({ modalType: 'SELF_TAG', ignoreFocus: false }));
  }, [dispatch]);

  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!imgRef.current) return;
      const rect = imgRef.current.getBoundingClientRect();
      setPin({
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      });
      setError(null);
    },
    [],
  );

  const handleImageKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter') e.currentTarget.click();
    },
    [],
  );

  const handleConfirm = useCallback(() => {
    if (!myId || submitting) return;
    setSubmitting(true);
    setError(null);
    apiAddMediaTag(mediaId, myId, pin.x, pin.y)
      .then(() => {
        close();
      })
      .catch((err: unknown) => {
        const apiError = (err as { response?: { data?: { error?: string } } })
          .response?.data?.error;
        setError(
          apiError === 'Record invalid'
            ? 'You are already tagged here'
            : (apiError ?? 'Something went wrong, please try again'),
        );
        setSubmitting(false);
      });
  }, [mediaId, myId, pin.x, pin.y, submitting, close]);

  return (
    <div className='modal-root__modal tag-people-modal'>
      <div className='tag-people-modal__header'>
        <h3>{intl.formatMessage(messages.title)}</h3>
        <p className='tag-people-modal__hint'>
          {intl.formatMessage(messages.clickToPlace)}
        </p>
      </div>

      <div className='tag-people-modal__image-wrapper'>
        <div
          ref={imgRef}
          className='tag-people-modal__image'
          onClick={handleImageClick}
          role='button'
          tabIndex={0}
          aria-label={intl.formatMessage(messages.clickToPlace)}
          onKeyDown={handleImageKeyDown}
        >
          <img src={previewUrl} alt='' draggable={false} />

          <div
            className='tag-people-modal__pin tag-people-modal__pin--self'
            style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
          />
        </div>

        {error && <p className='tag-people-modal__error'>{error}</p>}
      </div>

      <div className='tag-people-modal__footer'>
        <button
          type='button'
          className='button button--secondary'
          onClick={close}
          disabled={submitting}
        >
          <FormattedMessage id='self_tag.cancel' defaultMessage='Cancel' />
        </button>
        <button
          type='button'
          className='button'
          onClick={handleConfirm}
          disabled={submitting}
        >
          {submitting ? (
            <FormattedMessage id='self_tag.tagging' defaultMessage='Tagging…' />
          ) : (
            <FormattedMessage
              id='self_tag.confirm'
              defaultMessage='Tag myself here'
            />
          )}
        </button>
      </div>
    </div>
  );
};
