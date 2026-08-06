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

import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { FormattedMessage } from 'react-intl';

import axios from 'axios';

import api, { apiRequestPost } from 'mastodon/api';
import { KornerKrewPicker } from 'mastodon/components/korner_krew_picker';
import { KornerVisibilityPicker } from 'mastodon/components/korner_visibility_picker';
import { MediaPickButtons, VoiceRecorder } from 'mastodon/components/media';
import type { VoiceRecorderChange } from 'mastodon/components/media';

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
    setVoice(null);
  }, []);

  const onCaptionChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCaption(event.target.value.slice(0, MAX_CAPTION_LENGTH));
    },
    [],
  );

  const onVisibilityChange = useCallback((next: string) => {
    setVisibility(next as Visibility);
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
  ]);

  // ESLint no-misused-promises wants a void-returning handler; wrap
  // the async so the promise is dropped intentionally.
  const submit = useCallback(() => {
    void submitAsync();
  }, [submitAsync]);

  // Portal to <body> so the fixed overlay escapes the feed column's
  // containing block. On classic feed routes (Home) the ancestor
  // `.columns-area__panels__main` sets `contain: paint layout style`,
  // which makes it the containing block for `position: fixed` — so an
  // inline overlay's backdrop only darkens the column and its panel is
  // clipped out of view (see _kronk_stage.scss § containment escape).
  return createPortal(
    <div className='moments-composer'>
      <button
        type='button'
        className='moments-composer__backdrop'
        onClick={onClose}
        aria-label='Close composer'
      />
      <div className='moments-composer__panel'>
        <header className='moments-composer__header'>
          <h2 className='moments-composer__title'>
            <FormattedMessage
              id='moments.composer.title'
              defaultMessage='Share a Moment'
            />
          </h2>
          <p className='moments-composer__subtitle'>
            <FormattedMessage
              id='moments.composer.subtitle'
              defaultMessage='Gone in 24 hours.'
            />
          </p>
        </header>

        <section className='moments-composer__section'>
          <span className='moments-composer__label'>
            <FormattedMessage
              id='moments.composer.media'
              defaultMessage='Media'
            />
          </span>
          {files.length > 0 ? (
            <div className='moments-composer__file-summary'>
              {files.length === 1 ? (
                (files[0]?.name ?? '')
              ) : (
                <FormattedMessage
                  id='moments.composer.file_summary_multi'
                  defaultMessage='{count} photos selected'
                  values={{ count: files.length }}
                />
              )}
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

        <section className='moments-composer__section'>
          <span className='moments-composer__label'>
            <FormattedMessage
              id='moments.composer.visibility'
              defaultMessage='Who sees it'
            />
          </span>
          <KornerVisibilityPicker
            slug='moments'
            value={visibility}
            onChange={onVisibilityChange}
            className='moments-composer__visibility'
          />
          {visibility === 'krew' && (
            <KornerKrewPicker
              value={krewId}
              onChange={setKrewId}
              disabled={posting}
              className='moments-composer__krew'
            />
          )}
        </section>

        {error && <div className='moments-composer__error'>{error}</div>}

        <footer className='moments-composer__footer'>
          <button
            type='button'
            className='moments-composer__cancel'
            onClick={onClose}
            disabled={posting}
          >
            <FormattedMessage
              id='moments.composer.cancel'
              defaultMessage='Cancel'
            />
          </button>
          <button
            type='button'
            className='moments-composer__post'
            onClick={submit}
            disabled={
              files.length === 0 ||
              posting ||
              (visibility === 'krew' && !krewId)
            }
          >
            {posting ? (
              postingProgress && postingProgress.total > 1 ? (
                <FormattedMessage
                  id='moments.composer.posting_multi'
                  defaultMessage='Sharing {current} of {total}…'
                  values={{
                    current: postingProgress.current,
                    total: postingProgress.total,
                  }}
                />
              ) : (
                <FormattedMessage
                  id='moments.composer.posting'
                  defaultMessage='Sharing…'
                />
              )
            ) : files.length > 1 ? (
              <FormattedMessage
                id='moments.composer.post_multi'
                defaultMessage='Share {count}'
                values={{ count: files.length }}
              />
            ) : (
              <FormattedMessage
                id='moments.composer.post'
                defaultMessage='Share'
              />
            )}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
};
