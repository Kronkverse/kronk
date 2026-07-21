import { useState, useCallback, useRef } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import AttachIcon from '@/material-icons/400-24px/add_photo_alternate.svg?react';
import SendIcon from '@/material-icons/400-24px/arrow_upward-fill.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import { apiUploadMedia } from 'mastodon/api/nudges_conversations';

const messages = defineMessages({
  placeholder: {
    id: 'nudges.composer.placeholder',
    defaultMessage: 'Message…',
  },
  send: { id: 'nudges.composer.send', defaultMessage: 'Send' },
  attach: { id: 'nudges.composer.attach', defaultMessage: 'Attach media' },
  remove: {
    id: 'nudges.composer.remove_attachment',
    defaultMessage: 'Remove attachment',
  },
  uploading: {
    id: 'nudges.composer.uploading',
    defaultMessage: 'Uploading…',
  },
  uploadFailed: {
    id: 'nudges.composer.upload_failed',
    defaultMessage: 'Upload failed. Try again.',
  },
});

interface ComposerProps {
  onSend: (body: string, mediaAttachmentIds: string[]) => Promise<void> | void;
}

interface StagedMedia {
  id: string;
  previewUrl: string; // object-URL for immediate preview
  type: string;
}

const ACCEPT = 'image/*,video/*';
const MAX_MEDIA = 4;

// Composer with a text field + attach affordance. Up to MAX_MEDIA
// attachments per message (matches Mastodon Status default). Voice
// recording is kronk-app parity-gated per docs/kronk_nudges.md
// §Surface 4.
export const Composer: React.FC<ComposerProps> = ({ onSend }) => {
  const intl = useIntl();
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const [staged, setStaged] = useState<StagedMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);
    },
    [],
  );

  const clearStaged = useCallback(() => {
    setStaged((prev) => {
      prev.forEach((m) => {
        URL.revokeObjectURL(m.previewUrl);
      });
      return [];
    });
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  const removeStagedById = useCallback((id: string) => {
    setStaged((prev) => {
      const target = prev.find((m) => m.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((m) => m.id !== id);
    });
  }, []);

  const submit = useCallback(async () => {
    const body = value.trim();
    if ((!body && staged.length === 0) || sending) return;
    setSending(true);
    try {
      await onSend(
        body,
        staged.map((m) => m.id),
      );
      setValue('');
      clearStaged();
      inputRef.current?.focus();
    } finally {
      setSending(false);
    }
  }, [value, staged, sending, onSend, clearStaged]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      void submit();
    },
    [submit],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void submit();
      }
    },
    [submit],
  );

  const handleFileClick = useCallback(() => {
    fileRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;

      setUploadError(null);
      setUploading(true);

      const remaining = MAX_MEDIA - staged.length;
      const toUpload = files.slice(0, remaining);

      const run = async () => {
        try {
          const uploaded = await Promise.all(
            toUpload.map(async (file) => {
              const previewUrl = URL.createObjectURL(file);
              try {
                const result = await apiUploadMedia(file);
                return {
                  id: result.id,
                  previewUrl,
                  type: result.type,
                } satisfies StagedMedia;
              } catch (err) {
                URL.revokeObjectURL(previewUrl);
                throw err;
              }
            }),
          );
          setStaged((prev) => [...prev, ...uploaded]);
        } catch {
          setUploadError(intl.formatMessage(messages.uploadFailed));
        } finally {
          setUploading(false);
          if (fileRef.current) fileRef.current.value = '';
        }
      };
      void run();
    },
    [intl, staged.length],
  );

  const canSend =
    (value.trim() !== '' || staged.length > 0) && !sending && !uploading;
  const canAttachMore = staged.length < MAX_MEDIA;

  return (
    <form className='nudges-composer' onSubmit={handleSubmit}>
      {(staged.length > 0 || uploading || uploadError !== null) && (
        <div className='nudges-composer__staged'>
          {uploading && (
            <span className='nudges-composer__staged-status'>
              {intl.formatMessage(messages.uploading)}
            </span>
          )}
          {uploadError && (
            <span
              className='nudges-composer__staged-status nudges-composer__staged-status--error'
              role='alert'
            >
              {uploadError}
            </span>
          )}
          {staged.map((m) => (
            <StagedPreview
              key={m.id}
              media={m}
              onRemove={removeStagedById}
              removeLabel={intl.formatMessage(messages.remove)}
            />
          ))}
        </div>
      )}

      <div className='nudges-composer__row'>
        <button
          type='button'
          className='nudges-composer__attach'
          onClick={handleFileClick}
          aria-label={intl.formatMessage(messages.attach)}
          disabled={sending || uploading || !canAttachMore}
        >
          <AttachIcon />
        </button>

        <input
          ref={fileRef}
          type='file'
          accept={ACCEPT}
          multiple
          className='nudges-composer__file'
          onChange={handleFileChange}
        />

        <textarea
          ref={inputRef}
          className='nudges-composer__input'
          placeholder={intl.formatMessage(messages.placeholder)}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={1}
        />

        <button
          type='submit'
          className='nudges-composer__send'
          disabled={!canSend}
          aria-label={intl.formatMessage(messages.send)}
        >
          <SendIcon />
        </button>
      </div>
    </form>
  );
};

interface StagedPreviewProps {
  media: StagedMedia;
  removeLabel: string;
  onRemove: (id: string) => void;
}

const StagedPreview: React.FC<StagedPreviewProps> = ({
  media,
  removeLabel,
  onRemove,
}) => {
  const handleRemove = useCallback(() => {
    onRemove(media.id);
  }, [media.id, onRemove]);

  return (
    <div
      className={`nudges-composer__staged-preview nudges-composer__staged-preview--${media.type}`}
    >
      {media.type === 'video' ? (
        <video
          className='nudges-composer__staged-media'
          src={media.previewUrl}
          muted
        />
      ) : (
        <img
          className='nudges-composer__staged-media'
          src={media.previewUrl}
          alt=''
        />
      )}
      <button
        type='button'
        className='nudges-composer__staged-remove'
        onClick={handleRemove}
        aria-label={removeLabel}
      >
        <CloseIcon />
      </button>
    </div>
  );
};
