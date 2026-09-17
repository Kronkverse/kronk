import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import AddPhotoIcon from '@/material-icons/400-24px/add_photo_alternate.svg?react';
import SendIcon from '@/material-icons/400-24px/arrow_upward-fill.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import MicIcon from '@/material-icons/400-24px/mic.svg?react';
import StopIcon from '@/material-icons/400-24px/stop.svg?react';
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
  recording: {
    id: 'nudges.composer.recording',
    defaultMessage: 'Recording',
  },
  stopRecording: {
    id: 'nudges.composer.stop_recording',
    defaultMessage: 'Stop and send',
  },
  cancelRecording: {
    id: 'nudges.composer.cancel_recording',
    defaultMessage: 'Cancel recording',
  },
  micDenied: {
    id: 'nudges.composer.mic_denied',
    defaultMessage: 'Microphone access denied.',
  },
  micUnavailable: {
    id: 'nudges.composer.mic_unavailable',
    defaultMessage: 'No microphone available.',
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
const ACCEPT_FILE = 'image/*,video/*,audio/*';

const formatDuration = (totalSeconds: number): string => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};
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
  const [recording, setRecording] = useState(false);
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const attachWrapRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingCancelledRef = useRef(false);

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
  const handlePickFile = useCallback(() => {
    pickFiles(ACCEPT_FILE);
  }, [pickFiles]);

  // Voice-note recording — MediaRecorder captures from the mic on
  // click, releases on stop, and stages the resulting blob as an audio
  // attachment. The composer swaps its main row for a recording panel
  // (see the JSX below) while `recording` is true. On unmount /
  // conversation-switch we stop the stream + the timer so the mic
  // isn't held open past the composer's lifetime.
  const teardownRecording = useCallback(() => {
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    recordingStreamRef.current?.getTracks().forEach((t) => {
      t.stop();
    });
    recordingStreamRef.current = null;
    mediaRecorderRef.current = null;
    recordingChunksRef.current = [];
    setRecording(false);
    setRecordedSeconds(0);
  }, []);

  const handlePickVoice = useCallback(() => {
    setAttachMenuOpen(false);
    setUploadError(null);
    recordingCancelledRef.current = false;

    if (
      typeof navigator === 'undefined' ||
      typeof MediaRecorder === 'undefined'
    ) {
      setUploadError(intl.formatMessage(messages.micUnavailable));
      return;
    }

    void (async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        setUploadError(intl.formatMessage(messages.micDenied));
        return;
      }
      const recorder = new MediaRecorder(stream);
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordingChunksRef.current = [];

      recorder.addEventListener('dataavailable', (e) => {
        if (e.data.size > 0) recordingChunksRef.current.push(e.data);
      });

      recorder.addEventListener('stop', () => {
        const chunks = recordingChunksRef.current;
        const cancelled = recordingCancelledRef.current;
        const mimeType = recorder.mimeType || 'audio/webm';
        teardownRecording();
        if (cancelled || chunks.length === 0) return;

        const ext = mimeType.includes('mp4')
          ? 'm4a'
          : mimeType.includes('ogg')
            ? 'ogg'
            : 'webm';
        const blob = new Blob(chunks, { type: mimeType });
        const file = new File([blob], `voice-note.${ext}`, { type: mimeType });
        const previewUrl = URL.createObjectURL(file);

        setUploading(true);
        void (async () => {
          try {
            const result = await apiUploadMedia(file);
            setStaged((prev) => [
              ...prev,
              { id: result.id, previewUrl, type: result.type },
            ]);
          } catch {
            URL.revokeObjectURL(previewUrl);
            setUploadError(intl.formatMessage(messages.uploadFailed));
          } finally {
            setUploading(false);
          }
        })();
      });

      recorder.start();
      setRecording(true);
      setRecordedSeconds(0);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordedSeconds((s) => s + 1);
      }, 1000);
    })();
  }, [intl, teardownRecording]);

  const handleStopRecording = useCallback(() => {
    recordingCancelledRef.current = false;
    mediaRecorderRef.current?.stop();
  }, []);

  const handleCancelRecording = useCallback(() => {
    recordingCancelledRef.current = true;
    mediaRecorderRef.current?.stop();
  }, []);

  // Stop any active recording when the composer unmounts (parent keys
  // the composer on conversationId, so switching conversations also
  // fires this). Without cleanup the mic tab-indicator stays on and
  // the stream leaks.
  useEffect(() => teardownRecording, [teardownRecording]);

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

      {recording && (
        <div
          className='nudges-composer__recorder'
          role='status'
          aria-live='polite'
        >
          <button
            type='button'
            className='nudges-composer__recorder-cancel'
            onClick={handleCancelRecording}
            aria-label={intl.formatMessage(messages.cancelRecording)}
          >
            <CloseIcon />
          </button>
          <span className='nudges-composer__recorder-status'>
            <span className='nudges-composer__recorder-dot' aria-hidden />
            <span className='nudges-composer__recorder-label'>
              {intl.formatMessage(messages.recording)}
            </span>
            <span className='nudges-composer__recorder-time'>
              {formatDuration(recordedSeconds)}
            </span>
          </span>
          <button
            type='button'
            className='nudges-composer__recorder-stop'
            onClick={handleStopRecording}
            aria-label={intl.formatMessage(messages.stopRecording)}
          >
            <StopIcon />
          </button>
        </div>
      )}

      <div className='nudges-composer__row' hidden={recording}>
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
