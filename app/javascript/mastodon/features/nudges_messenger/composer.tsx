import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import AddPhotoIcon from '@/material-icons/400-24px/add_photo_alternate.svg?react';
import SendIcon from '@/material-icons/400-24px/arrow_upward-fill.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import MicIcon from '@/material-icons/400-24px/mic.svg?react';
import UploadFileIcon from '@/material-icons/400-24px/upload_file.svg?react';
import { apiUploadMedia } from 'mastodon/api/nudges_conversations';
import { useComposerDraft } from 'mastodon/hooks/useComposerDraft';

const messages = defineMessages({
  placeholder: {
    id: 'nudges.composer.placeholder',
    defaultMessage: 'Message…',
  },
  send: { id: 'nudges.composer.send', defaultMessage: 'Send' },
  attach: { id: 'nudges.composer.attach', defaultMessage: 'Add attachment' },
  attachPhotos: {
    id: 'nudges.composer.attach.photos',
    defaultMessage: 'Photos',
  },
  attachVoice: {
    id: 'nudges.composer.attach.voice',
    defaultMessage: 'Voice note',
  },
  attachFile: {
    id: 'nudges.composer.attach.file',
    defaultMessage: 'File',
  },
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
  // Namespaces the draft store so multiple open conversations don't
  // stomp each other. Optional so callers without a stable id (rare)
  // still get a working composer, just without persistence.
  conversationId?: string;
}

interface StagedMedia {
  id: string;
  previewUrl: string; // object-URL for immediate preview
  type: string;
}

// MIME buckets exposed by the "+" drop-up menu. Server-side
// `MediaAttachment` accepts image / video / audio (see
// `app/models/media_attachment.rb`). The "File" option is the union
// of what the server accepts — a wider net than Photos or Voice but
// still bounded by what the API will actually take. When
// MediaAttachment gains generic-file support, widen this to '*/*'
// and add a preview branch for the unknown type below.
const ACCEPT_PHOTOS = 'image/*,video/*';
const ACCEPT_VOICE = 'audio/*';
const ACCEPT_FILE = 'image/*,video/*,audio/*';
// Keep in step with Nudges::ConversationMessage::MAX_MEDIA — the server
// rejects a sixth, and the composer should never offer what the server
// refuses.
const MAX_MEDIA = 5;

// Composer with a text field + attach affordance. Up to MAX_MEDIA
// attachments per message (matches Mastodon Status default). Voice
// recording is kronk-app parity-gated per docs/kronk_nudges.md
// §Surface 4. Unsent text is persisted per conversation via the shared
// useComposerDraft hook so a nav-away doesn't drop what you were typing.
// The parent keys this component on conversationId, so switching
// conversations remounts it and restores that conversation's draft.
export const Composer: React.FC<ComposerProps> = ({
  onSend,
  conversationId,
}) => {
  const intl = useIntl();
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const [staged, setStaged] = useState<StagedMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const attachWrapRef = useRef<HTMLDivElement>(null);

  // Persist unsent text per conversation (shared draft mechanism). Silent
  // restore — no pill — matching a chat input's expectation that a draft is
  // just there. Inert without a conversationId.
  const draftSnapshot = useMemo(() => ({ value }), [value]);
  const handleRestore = useCallback((d: { value: string }) => {
    setValue(d.value);
  }, []);
  useComposerDraft(
    `nudges:conversation:${conversationId ?? ''}`,
    draftSnapshot,
    handleRestore,
    { active: Boolean(conversationId), enabled: value.trim() !== '' },
  );

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

  // Open the file picker for a specific attachment kind. Sets the
  // input's `accept` at click time so a single hidden input serves all
  // three menu options (Photos / Voice / File), then triggers the
  // native picker.
  const pickFiles = useCallback((accept: string) => {
    const input = fileRef.current;
    if (!input) return;
    input.accept = accept;
    input.click();
    setAttachMenuOpen(false);
  }, []);

  const handlePickPhotos = useCallback(() => {
    pickFiles(ACCEPT_PHOTOS);
  }, [pickFiles]);
  const handlePickVoice = useCallback(() => {
    pickFiles(ACCEPT_VOICE);
  }, [pickFiles]);
  const handlePickFile = useCallback(() => {
    pickFiles(ACCEPT_FILE);
  }, [pickFiles]);

  const toggleAttachMenu = useCallback(() => {
    setAttachMenuOpen((open) => !open);
  }, []);

  // Close the drop-up on outside click / Escape. Skipped when the menu
  // isn't open so we don't attach listeners for nothing.
  useEffect(() => {
    if (!attachMenuOpen) return undefined;
    const onDown = (e: MouseEvent) => {
      if (!attachWrapRef.current?.contains(e.target as Node)) {
        setAttachMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAttachMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [attachMenuOpen]);

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
        <div className='nudges-composer__attach-wrap' ref={attachWrapRef}>
          <button
            type='button'
            className='nudges-composer__attach'
            onClick={toggleAttachMenu}
            aria-label={intl.formatMessage(messages.attach)}
            aria-haspopup='menu'
            aria-expanded={attachMenuOpen}
            disabled={sending || uploading || !canAttachMore}
          >
            <AddIcon />
          </button>

          {attachMenuOpen && (
            <div className='nudges-composer__attach-menu' role='menu'>
              <button
                type='button'
                role='menuitem'
                className='nudges-composer__attach-menu-item'
                onClick={handlePickPhotos}
              >
                <AddPhotoIcon />
                <span>{intl.formatMessage(messages.attachPhotos)}</span>
              </button>
              <button
                type='button'
                role='menuitem'
                className='nudges-composer__attach-menu-item'
                onClick={handlePickVoice}
              >
                <MicIcon />
                <span>{intl.formatMessage(messages.attachVoice)}</span>
              </button>
              <button
                type='button'
                role='menuitem'
                className='nudges-composer__attach-menu-item'
                onClick={handlePickFile}
              >
                <UploadFileIcon />
                <span>{intl.formatMessage(messages.attachFile)}</span>
              </button>
            </div>
          )}
        </div>

        <input
          ref={fileRef}
          type='file'
          accept={ACCEPT_FILE}
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
      {media.type === 'video' && (
        <video
          className='nudges-composer__staged-media'
          src={media.previewUrl}
          muted
        />
      )}
      {media.type === 'audio' && (
        <span className='nudges-composer__staged-audio' aria-hidden>
          <MicIcon />
        </span>
      )}
      {media.type !== 'video' && media.type !== 'audio' && (
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
