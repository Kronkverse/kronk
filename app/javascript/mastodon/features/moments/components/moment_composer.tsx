import { useCallback, useRef, useState } from 'react';

import { FormattedMessage, defineMessages, useIntl } from 'react-intl';

import AddPhotoIcon from '@/material-icons/400-24px/add_photo_alternate.svg?react';
import api from 'mastodon/api';
import type { ApiStatusJSON } from 'mastodon/api_types/statuses';
import { Icon } from 'mastodon/components/icon';

const messages = defineMessages({
  placeholder: {
    id: 'moments.compose.placeholder',
    defaultMessage: "What's on your mind?",
  },
});

export const MomentComposer: React.FC<{
  onCreated: (moment: ApiStatusJSON) => void;
}> = ({ onCreated }) => {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpen = useCallback(() => {
    setOpen(true);
  }, []);

  const handleCancel = useCallback(() => {
    setOpen(false);
    setText('');
    setMediaFile(null);
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview);
    }
    setMediaPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [mediaPreview]);

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
    },
    [],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (mediaPreview) {
        URL.revokeObjectURL(mediaPreview);
      }
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
    },
    [mediaPreview],
  );

  const handleRemoveMedia = useCallback(() => {
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview);
    }
    setMediaFile(null);
    setMediaPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [mediaPreview]);

  const handleSubmit = useCallback(async () => {
    if (!text.trim() && !mediaFile) return;
    setSubmitting(true);
    try {
      let mediaIds: string[] = [];
      if (mediaFile) {
        const formData = new FormData();
        formData.append('file', mediaFile);
        const uploadRes = await api().post<{ id: string }>(
          '/api/v1/media',
          formData,
        );
        mediaIds = [uploadRes.data.id];
      }
      const res = await api().post<ApiStatusJSON>('/api/v1/statuses', {
        status: text,
        post_type: 'moment',
        visibility: 'public',
        ...(mediaIds.length > 0 ? { media_ids: mediaIds } : {}),
      });
      onCreated(res.data);
      handleCancel();
    } catch {
      // leave the composer open on error so the user can retry
    } finally {
      setSubmitting(false);
    }
  }, [text, mediaFile, onCreated, handleCancel]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        void handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleMediaButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleSubmitClick = useCallback(() => {
    void handleSubmit();
  }, [handleSubmit]);

  const canSubmit = (text.trim().length > 0 || !!mediaFile) && !submitting;

  if (!open) {
    return (
      <button
        type='button'
        className='moment-composer-banner'
        onClick={handleOpen}
      >
        <span className='moment-composer-banner__prompt'>
          <FormattedMessage
            id='moments.compose.prompt'
            defaultMessage='Share a moment…'
          />
        </span>
      </button>
    );
  }

  const isVideo =
    mediaFile?.type.startsWith('video/') ??
    mediaFile?.type.startsWith('audio/') ??
    false;

  return (
    <div className='moment-composer-banner moment-composer-banner--open'>
      <textarea
        className='moment-composer-banner__input'
        placeholder={intl.formatMessage(messages.placeholder)}
        value={text}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        rows={3}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
      />

      {mediaPreview && (
        <div className='moment-composer-banner__preview'>
          {isVideo ? (
            <video
              src={mediaPreview}
              className='moment-composer-banner__preview-media'
              controls
            />
          ) : (
            <img
              src={mediaPreview}
              alt=''
              className='moment-composer-banner__preview-media'
            />
          )}
          <button
            type='button'
            className='moment-composer-banner__remove-media'
            onClick={handleRemoveMedia}
            aria-label='Remove media'
          >
            ×
          </button>
        </div>
      )}

      <div className='moment-composer-banner__actions'>
        <input
          type='file'
          accept='image/*,video/*'
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
          aria-hidden='true'
        />
        <button
          type='button'
          className='moment-composer-banner__media-btn'
          onClick={handleMediaButtonClick}
          aria-label='Add media'
        >
          <Icon id='add-photo' icon={AddPhotoIcon} />
          <FormattedMessage
            id='moments.compose.add_media'
            defaultMessage='Media'
          />
        </button>

        <div className='moment-composer-banner__actions-right'>
          <button
            type='button'
            className='moment-composer-banner__cancel'
            onClick={handleCancel}
          >
            <FormattedMessage
              id='moments.compose.cancel'
              defaultMessage='Cancel'
            />
          </button>
          <button
            type='button'
            className='moment-composer-banner__submit'
            onClick={handleSubmitClick}
            disabled={!canSubmit}
          >
            {submitting ? (
              <FormattedMessage
                id='moments.compose.submitting'
                defaultMessage='Sharing…'
              />
            ) : (
              <FormattedMessage
                id='moments.compose.submit'
                defaultMessage='Share'
              />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
