import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import api from 'mastodon/api';
import { apiContributePhoto } from 'mastodon/api/albutts';

const messages = defineMessages({
  heading: {
    id: 'albutts.contribute.heading',
    defaultMessage: 'Add a photo',
  },
  fileLabel: {
    id: 'albutts.contribute.file_label',
    defaultMessage: 'Photo',
  },
  captionLabel: {
    id: 'albutts.contribute.caption_label',
    defaultMessage: 'Caption (optional)',
  },
  cancel: {
    id: 'albutts.contribute.cancel',
    defaultMessage: 'Cancel',
  },
  submit: {
    id: 'albutts.contribute.submit',
    defaultMessage: 'Add to album',
  },
  uploading: {
    id: 'albutts.contribute.uploading',
    defaultMessage: 'Uploading…',
  },
  error: {
    id: 'albutts.contribute.error',
    defaultMessage: "Couldn't add photo — try again.",
  },
});

const CAPTION_MAX = 500;

interface ContributeComposerProps {
  albumId: string;
  onCancel: () => void;
  onContributed: () => void;
}

interface MediaResponse {
  id: string;
}

export const ContributeComposer: React.FC<ContributeComposerProps> = ({
  albumId,
  onCancel,
  onContributed,
}) => {
  const intl = useIntl();
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0] ?? null;
    setFile(chosen);
  }, []);

  const handleCaption = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCaption(e.target.value.slice(0, CAPTION_MAX));
    },
    [],
  );

  const submit = useCallback(() => {
    if (!file || pending) return;
    setPending(true);
    setError(null);
    void (async () => {
      try {
        // Upload to Mastodon media first, then reference the returned
        // MediaAttachment id from the album_photos row. The
        // contributor's account owns that attachment, satisfying the
        // "attribution belongs to contributor" invariant enforced by
        // AlbumPhoto's validation.
        const form = new FormData();
        form.append('file', file);
        const media = await api().post<MediaResponse>('/api/v1/media', form);

        await apiContributePhoto(albumId, {
          media_id: media.data.id,
          caption: caption.trim() || undefined,
        });

        onContributed();
      } catch {
        setError('contribute_failed');
        setPending(false);
      }
    })();
  }, [albumId, caption, file, onContributed, pending]);

  return (
    <div className='albutts-composer' role='dialog' aria-modal='true'>
      <div className='albutts-composer__panel'>
        <h2 className='albutts-composer__heading'>
          {intl.formatMessage(messages.heading)}
        </h2>

        <label
          className='albutts-composer__label'
          htmlFor='albutts-contribute-file'
        >
          {intl.formatMessage(messages.fileLabel)}
        </label>
        <input
          id='albutts-contribute-file'
          type='file'
          accept='image/*,video/*'
          className='albutts-composer__file'
          onChange={handleFile}
        />

        <label
          className='albutts-composer__label'
          htmlFor='albutts-contribute-caption'
        >
          {intl.formatMessage(messages.captionLabel)}
        </label>
        <textarea
          id='albutts-contribute-caption'
          className='albutts-composer__textarea'
          value={caption}
          onChange={handleCaption}
          maxLength={CAPTION_MAX}
        />

        {error && (
          <p className='albutts-composer__error' role='alert'>
            {intl.formatMessage(messages.error)}
          </p>
        )}

        <div className='albutts-composer__actions'>
          <button
            type='button'
            className='albutts-btn albutts-btn--ghost'
            onClick={onCancel}
            disabled={pending}
          >
            {intl.formatMessage(messages.cancel)}
          </button>
          <button
            type='button'
            className='albutts-btn albutts-btn--primary'
            onClick={submit}
            disabled={!file || pending}
          >
            {pending
              ? intl.formatMessage(messages.uploading)
              : intl.formatMessage(messages.submit)}
          </button>
        </div>
      </div>
    </div>
  );
};
