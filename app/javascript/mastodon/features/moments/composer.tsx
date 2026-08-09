// Moments composer. Uploads one media attachment (a photo or a
// ≤60 s video) and, when the media is a still photo, optionally
// pairs it with a browser-recorded voice clip (≤60 s). Third media
// shape spec: docs/spaces/moments.md § What a Moment is.
//
// Media upload flow: POST /api/v2/media (multipart) → get the
// attachment id → POST /api/v1/moments with { media_attachment_id,
// voice_media_attachment_id, caption, visibility }.
//
// Multi-photo (Kommons #117047177063699814): when the user picks
// several photos at once, the composer posts them as N separate
// Moments in sequence, all sharing the same caption / visibility /
// krew. Voice pairing stays a single-photo affordance (and is only
// offered when exactly one still is picked). Video is single-shot
// only — if any file in the pick is a video, we keep just the first
// video and drop the rest.
//
// The cross-korner attach flows (Kalendar / Krew / Map / Klot /
// mARTketplace) declared in the spec are not shipped in v1 — they
// land in follow-ups.

import { useCallback, useEffect, useMemo, useState } from 'react';

import { FormattedMessage, useIntl, defineMessages } from 'react-intl';

import axios from 'axios';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import api, { apiRequestPost } from 'mastodon/api';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { KornerKrewPicker } from 'mastodon/components/korner_krew_picker';
import { MediaPickButtons, VoiceRecorder } from 'mastodon/components/media';
import type { VoiceRecorderChange } from 'mastodon/components/media';
import type { ReachValue } from 'mastodon/components/reach_dropdown';
import { ReachDropdown } from 'mastodon/components/reach_dropdown';

import { MomentsTextEditor } from './text_editor';
import type { TextOverlay } from './text_overlay';
import { OverlayLayer } from './text_overlay';

// Reach ladder + krew (docs/kronk_feed_and_reach.md §2), minus
// `self_only` — dropped from the Moments composer because an
// audience-of-one on an ephemeral share is a private journal, not a
// Moment (see docs/spaces/moments.md § Reach). The DB enum keeps it
// for older rows. The shared visibility picker reads
// `visibility_scopes` from the moments manifest; picking `krew`
// reveals the krew sub-picker below.
type Visibility = 'public' | 'orbit' | 'mates' | 'krew';

interface MediaResponse {
  id: string;
}

interface MomentResponse {
  id: string;
}

interface Props {
  onClose: () => void;
  onPosted: () => void;
}

const MAX_CAPTION_LENGTH = 500;
const VOICE_MAX_SECONDS = 60;

export const MomentsComposer = ({ onClose, onPosted }: Props) => {
  const [files, setFiles] = useState<File[]>([]);
  // Preview URLs parallel to `files`. Held in state (not derived at
  // render) so we can revoke them on file change / unmount without
  // re-creating them on every render tick.
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  // Per-file text overlays. Parallel array to `files`; index i's
  // overlays fly with files[i]. Empty on newly-picked files; the
  // editor writes back into this slot on Done.
  const [overlaysByFile, setOverlaysByFile] = useState<TextOverlay[][]>([]);
  // Which photo the text editor is open on. Null = editor closed.
  const [editorIndex, setEditorIndex] = useState<number | null>(null);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('mates');
  const [krewId, setKrewId] = useState<string | null>(null);
  const [voice, setVoice] = useState<VoiceRecorderChange | null>(null);
  const [posting, setPosting] = useState(false);
  const [postingProgress, setPostingProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Voice only makes sense over a *single* still photo — a mixed or
  // multi-photo batch drops the voice affordance entirely, and video
  // already carries its own audio track (spec § What a Moment is).
  // Destructure so `noUncheckedIndexedAccess` gets a nullable local
  // rather than an unguarded `files[0]`.
  const voiceEligible = useMemo(() => {
    const [only] = files;
    return only !== undefined && !only.type.startsWith('video/');
  }, [files]);

  const onFileChange = useCallback((picked: File[]) => {
    // A pick that contains any video collapses to just the first
    // video — video-in-Moments is single-shot only, and a
    // "photo+video batch" doesn't have obvious semantics.
    const firstVideo = picked.find((f) => f.type.startsWith('video/'));
    const next = firstVideo ? [firstVideo] : picked;
    setFiles(next);
    // Fresh pick → fresh overlays. Videos never get overlays (the
    // editor is a still-image-only surface for v1).
    setOverlaysByFile(next.map(() => []));
    // Newly picked video / multi-photo batch both invalidate any
    // prior voice recording — don't leave stray state around when
    // the constraint flips. `isSingleStill` handles both branches
    // (video-in-single-slot and multi-photo) without indexing into
    // the array.
    const isSingleStill = next.length === 1 && !firstVideo;
    if (!isSingleStill) setVoice(null);
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
    setOverlaysByFile([]);
    setVoice(null);
  }, []);

  // Preview URLs — created on file change, revoked on next change /
  // unmount so we don't leak object URLs across batches.
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => {
      urls.forEach((u) => {
        URL.revokeObjectURL(u);
      });
    };
  }, [files]);

  const openEditor = useCallback((i: number) => {
    setEditorIndex(i);
  }, []);
  const closeEditor = useCallback(() => {
    setEditorIndex(null);
  }, []);
  // Commit handler for the editor. Reads the current `editorIndex`
  // from state, writes overlays into that slot, then advances the
  // editor to the next photo (or closes if this was the last).
  const handleEditorCommit = useCallback(
    (overlays: TextOverlay[]) => {
      setEditorIndex((cur) => {
        if (cur === null) return null;
        setOverlaysByFile((prev) => {
          const next = [...prev];
          next[cur] = overlays;
          return next;
        });
        return cur + 1 < files.length ? cur + 1 : null;
      });
    },
    [files.length],
  );

  // Explicit next / prev — used by the editor's carousel buttons
  // (multi-photo pick) without committing. Stable identity via
  // useCallback so the editor's JSX doesn't fail react/jsx-no-bind.
  const handleEditorNext = useCallback(() => {
    setEditorIndex((i) => (i !== null && i + 1 < files.length ? i + 1 : i));
  }, [files.length]);
  const handleEditorPrev = useCallback(() => {
    setEditorIndex((i) => (i !== null && i > 0 ? i - 1 : i));
  }, []);

  const onCaptionChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCaption(event.target.value.slice(0, MAX_CAPTION_LENGTH));
    },
    [],
  );

  // ReachDropdown emits the full 5-rung ladder; Moments hides
  // `self_only` in the menu so the callback only ever yields one of
  // our narrower Visibility values. Cast is safe on that ground.
  const onReachChange = useCallback((next: ReachValue) => {
    setVisibility(next as Visibility);
    if (next !== 'krew') setKrewId(null);
  }, []);

  const submitAsync = useCallback(async () => {
    if (files.length === 0 || posting) return;
    setPosting(true);
    setPostingProgress({ current: 0, total: files.length });
    setError(null);
    const trimmedCaption = caption.trim();
    const voiceMediaId = voiceEligible ? (voice?.mediaId ?? null) : null;
    const krewIdOrNull = visibility === 'krew' ? krewId : null;
    try {
      for (const [i, file] of files.entries()) {
        setPostingProgress({ current: i + 1, total: files.length });
        const form = new FormData();
        form.append('file', file);
        // `api()` has no baseURL, so the raw axios instance needs the
        // absolute `/api/…` path (unlike the apiRequest* helpers,
        // which prepend it). A bare `v1/media` posts relative to the
        // current page → 404. Matches the other korner composers'
        // upload path.
        const mediaResp = await api().post<MediaResponse>(
          '/api/v2/media',
          form,
          { headers: { 'Content-Type': 'multipart/form-data' } },
        );
        const mediaId = mediaResp.data.id;
        await apiRequestPost<MomentResponse>('v1/moments', {
          media_attachment_id: mediaId,
          // Voice pairs with a single-photo batch only (voiceEligible
          // already enforced when the recorder was reachable).
          voice_media_attachment_id: voiceMediaId,
          caption: trimmedCaption,
          visibility,
          krew_id: krewIdOrNull,
          text_overlays: overlaysByFile[i] ?? [],
        });
      }
      onPosted();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        setError(
          `Error ${err.response.status.toString()}: ${err.response.statusText}`,
        );
      } else {
        setError('Something went wrong.');
      }
      setPosting(false);
      setPostingProgress(null);
    }
  }, [
    files,
    voiceEligible,
    voice,
    caption,
    visibility,
    krewId,
    posting,
    onPosted,
    overlaysByFile,
  ]);

  // ESLint no-misused-promises wants a void-returning handler; wrap
  // the async so the promise is dropped intentionally.
  const submit = useCallback(() => {
    void submitAsync();
  }, [submitAsync]);

  const intl = useIntl();

  // Shell CTA label — file count drives the resting label ("Share" /
  // "Share N") and mid-flight the multi-item progress ("Sharing 2 of
  // 3…"). Shell owns the button; body just tells it what to say.
  const submitLabel =
    files.length > 1
      ? intl.formatMessage(shellMessages.postMulti, { count: files.length })
      : intl.formatMessage(shellMessages.post);
  const submittingLabel =
    postingProgress && postingProgress.total > 1
      ? intl.formatMessage(shellMessages.postingMulti, {
          current: postingProgress.current,
          total: postingProgress.total,
        })
      : intl.formatMessage(shellMessages.posting);
  const canSubmit =
    files.length > 0 && (visibility !== 'krew' || krewId !== null);

  // ReachDropdown lives in the shell header (right side, before the
  // close button) via the `headerAction` slot — feed-card shape per
  // Portal's compose reframe (#1230). `self_only` hidden because
  // Moments are ephemeral social sharing (spec: docs/spaces/moments.md
  // § Reach).
  const reachControl = (
    <ReachDropdown
      value={visibility as ReachValue}
      onChange={onReachChange}
      hide={['self_only']}
      disabled={posting}
    />
  );

  return (
    <>
      <ComposeShell
        korner='moments'
        label={intl.formatMessage(shellMessages.title)}
        subtitle={intl.formatMessage(shellMessages.subtitle)}
        submitLabel={submitLabel}
        submittingLabel={submittingLabel}
        submitting={posting}
        canSubmit={canSubmit}
        onSubmit={submit}
        onCancel={onClose}
        headerAction={reachControl}
      >
        <div className='moments-composer'>
          {visibility === 'krew' && (
            <KornerKrewPicker
              value={krewId}
              onChange={setKrewId}
              disabled={posting}
              className='moments-composer__krew'
            />
          )}

          <section className='moments-composer__section'>
            <span className='moments-composer__label'>
              <FormattedMessage
                id='moments.composer.media'
                defaultMessage='Media'
              />
            </span>
            {files.length > 0 ? (
              <div className='moments-composer__previews'>
                {files.map((file, i) => (
                  <PreviewThumb
                    key={`${file.name}-${i.toString()}`}
                    index={i}
                    file={file}
                    url={previewUrls[i] ?? ''}
                    overlays={overlaysByFile[i] ?? []}
                    disabled={posting}
                    onEdit={openEditor}
                  />
                ))}
                <button
                  type='button'
                  className='moments-composer__file-clear'
                  onClick={clearFiles}
                  disabled={posting}
                >
                  <FormattedMessage
                    id='moments.composer.file_clear'
                    defaultMessage='Change'
                  />
                </button>
              </div>
            ) : (
              <MediaPickButtons
                onPick={onFileChange}
                multiple
                className='moments-composer__pick'
              />
            )}
          </section>

          {voiceEligible && (
            <section className='moments-composer__section'>
              <span className='moments-composer__label'>
                <FormattedMessage
                  id='moments.composer.voice'
                  defaultMessage='Voice (optional)'
                />
              </span>
              <VoiceRecorder
                onChange={setVoice}
                maxSeconds={VOICE_MAX_SECONDS}
                disabled={posting}
                className='moments-composer__voice'
              />
            </section>
          )}

          <section className='moments-composer__section'>
            <label
              className='moments-composer__label'
              htmlFor='moments-composer-caption'
            >
              <FormattedMessage
                id='moments.composer.caption'
                defaultMessage='Caption (optional)'
              />
            </label>
            <textarea
              id='moments-composer-caption'
              className='moments-composer__caption'
              value={caption}
              onChange={onCaptionChange}
              maxLength={MAX_CAPTION_LENGTH}
              rows={2}
            />
          </section>

          {error && <div className='moments-composer__error'>{error}</div>}
        </div>
      </ComposeShell>

      {editorIndex !== null && files[editorIndex] && (
        <MomentsTextEditor
          file={files[editorIndex]}
          initial={overlaysByFile[editorIndex] ?? []}
          index={editorIndex}
          total={files.length}
          onCancel={closeEditor}
          onCommit={handleEditorCommit}
          onNext={editorIndex + 1 < files.length ? handleEditorNext : undefined}
          onPrev={editorIndex > 0 ? handleEditorPrev : undefined}
        />
      )}
    </>
  );
};

const shellMessages = defineMessages({
  title: {
    id: 'moments.composer.title',
    defaultMessage: 'Share a Moment',
  },
  subtitle: {
    id: 'moments.composer.subtitle',
    defaultMessage: 'Gone in 24 hours.',
  },
  post: {
    id: 'moments.composer.post',
    defaultMessage: 'Share',
  },
  postMulti: {
    id: 'moments.composer.post_multi',
    defaultMessage: 'Share {count}',
  },
  posting: {
    id: 'moments.composer.posting',
    defaultMessage: 'Sharing\u2026',
  },
  postingMulti: {
    id: 'moments.composer.posting_multi',
    defaultMessage: 'Sharing {current} of {total}\u2026',
  },
});

// One photo's preview tile in the composer's media section. Shows
// the actual picked pixels (via `URL.createObjectURL`), the current
// overlay layer (so the composer previews what will land), and an
// "Add text" or "Edit text" affordance that opens the editor.
// Videos render the file-name only — the text editor is a still-
// image surface in v1.
const PreviewThumb: React.FC<{
  index: number;
  file: File;
  url: string;
  overlays: TextOverlay[];
  disabled: boolean;
  onEdit: (i: number) => void;
}> = ({ index, file, url, overlays, disabled, onEdit }) => {
  const isVideo = file.type.startsWith('video/');
  const handleEdit = useCallback(() => {
    onEdit(index);
  }, [onEdit, index]);
  return (
    <div className='moments-composer__preview'>
      {isVideo ? (
        <div className='moments-composer__preview-video'>
          <span className='moments-composer__preview-video-badge'>▶</span>
          <span className='moments-composer__preview-video-name'>
            {file.name}
          </span>
        </div>
      ) : (
        <div className='moments-composer__preview-frame'>
          {url && (
            <img
              className='moments-composer__preview-img'
              src={url}
              alt=''
              aria-hidden
            />
          )}
          <OverlayLayer overlays={overlays} />
          <button
            type='button'
            className='moments-composer__preview-edit'
            onClick={handleEdit}
            disabled={disabled}
            aria-label={
              overlays.length > 0 ? 'Edit text overlays' : 'Add text overlay'
            }
          >
            {overlays.length > 0 ? <EditIcon /> : <AddIcon />}
          </button>
        </div>
      )}
    </div>
  );
};
