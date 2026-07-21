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
  onSend: (body: string, mediaAttachmentId?: string) => Promise<void> | void;
}

interface StagedMedia {
  id: string;
  previewUrl: string; // object-URL for immediate preview
  type: string;
}

const ACCEPT = 'image/*,video/*';

// Composer with a text field + attach affordance. Voice recording is
// kronk-app parity-gated per docs/kronk_nudges.md §Surface 4.
export const Composer: React.FC<ComposerProps> = ({ onSend }) => {
  const intl = useIntl();
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const [staged, setStaged] = useState<StagedMedia | null>(null);
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
    if (staged) URL.revokeObjectURL(staged.previewUrl);
    setStaged(null);
    if (fileRef.current) fileRef.current.value = '';
  }, [staged]);

  const submit = useCallback(async () => {
    const body = value.trim();
    if ((!body && !staged) || sending) return;
    setSending(true);
    try {
      await onSend(body, staged?.id);
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
      const file = e.target.files?.[0];
      if (!file) return;
      setUploadError(null);
      setUploading(true);
      const previewUrl = URL.createObjectURL(file);
      const run = async () => {
        try {
          const uploaded = await apiUploadMedia(file);
          setStaged({ id: uploaded.id, previewUrl, type: uploaded.type });
        } catch {
          URL.revokeObjectURL(previewUrl);
          setUploadError(intl.formatMessage(messages.uploadFailed));
        } finally {
          setUploading(false);
        }
      };
      void run();
    },
    [intl],
  );

  const canSend =
    (value.trim() !== '' || staged !== null) && !sending && !uploading;

  return (
    <form className='nudges-composer' onSubmit={handleSubmit}>
      {(staged !== null || uploading || uploadError !== null) && (
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
          {staged && (
            <div
              className={`nudges-composer__staged-preview nudges-composer__staged-preview--${staged.type}`}
            >
              {staged.type === 'video' ? (
                <video
                  className='nudges-composer__staged-media'
                  src={staged.previewUrl}
                  muted
                />
              ) : (
                <img
                  className='nudges-composer__staged-media'
                  src={staged.previewUrl}
                  alt=''
                />
              )}
              <button
                type='button'
                className='nudges-composer__staged-remove'
                onClick={clearStaged}
                aria-label={intl.formatMessage(messages.remove)}
              >
                <CloseIcon />
              </button>
            </div>
          )}
        </div>
      )}

      <div className='nudges-composer__row'>
        <button
          type='button'
          className='nudges-composer__attach'
          onClick={handleFileClick}
          aria-label={intl.formatMessage(messages.attach)}
          disabled={sending || uploading || staged !== null}
        >
          <AttachIcon />
        </button>

        <input
          ref={fileRef}
          type='file'
          accept={ACCEPT}
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
