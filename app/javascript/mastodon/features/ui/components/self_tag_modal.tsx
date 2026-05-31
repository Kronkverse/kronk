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
  const [done, setDone] = useState(false);

  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!imgRef.current) return;
      const rect = imgRef.current.getBoundingClientRect();
      setPin({
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      });
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
    apiAddMediaTag(mediaId, myId, pin.x, pin.y)
      .then(() => {
        setDone(true);
        setTimeout(() => {
          dispatch(closeModal({ modalType: 'SELF_TAG', ignoreFocus: false }));
        }, 800);
      })
      .catch(() => {
        setSubmitting(false);
      });
  }, [mediaId, myId, pin, submitting, dispatch]);

  const handleCancel = useCallback(() => {
    dispatch(closeModal({ modalType: 'SELF_TAG', ignoreFocus: false }));
  }, [dispatch]);

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
      </div>

      <div className='tag-people-modal__footer'>
        <button
          type='button'
          className='button button--secondary'
          onClick={handleCancel}
          disabled={submitting}
        >
          <FormattedMessage id='self_tag.cancel' defaultMessage='Cancel' />
        </button>
        <button
          type='button'
          className='button'
          onClick={handleConfirm}
          disabled={submitting || done}
        >
          {done ? (
            <FormattedMessage id='self_tag.tagged' defaultMessage='Tagged!' />
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
