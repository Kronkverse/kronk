// Moments composer. Uploads one media attachment (a photo or a
// ≤60 s video) and, when the media is a still photo, optionally
// pairs it with a browser-recorded voice clip (≤60 s). Third media
// shape spec: docs/spaces/moments.md § What a Moment is.
//
// Media upload flow: POST /api/v2/media (multipart) → get the
// attachment id → POST /api/v1/moments with { media_attachment_id,
// voice_media_attachment_id, caption, visibility }.
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

// Full four-tier ladder + krew (docs/kronk_feed_and_reach.md §2). The
// shared visibility picker reads `visibility_scopes` from the moments
// manifest; picking `krew` reveals the krew sub-picker below.
type Visibility = 'public' | 'orbit' | 'mates' | 'self_only' | 'krew';

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
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('mates');
  const [krewId, setKrewId] = useState<string | null>(null);
  const [voice, setVoice] = useState<VoiceRecorderChange | null>(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Voice only makes sense over a still photo — video already carries
  // its own audio track (spec § What a Moment is).
  const primaryIsStill = useMemo(
    () => !!file && !file.type.startsWith('video/'),
    [file],
  );

  const onFileChange = useCallback((picked: File) => {
    setFile(picked);
    // A newly-picked video invalidates any prior voice recording —
    // don't leave stray state around when the constraint flips.
    if (picked.type.startsWith('video/')) setVoice(null);
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
    if (!file || posting) return;
    setPosting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      // `api()` has no baseURL, so the raw axios instance needs the
      // absolute `/api/…` path (unlike the apiRequest* helpers, which
      // prepend it). A bare `v1/media` posts relative to the current
      // page → 404. Matches the other korner composers' upload path.
      const mediaResp = await api().post<MediaResponse>('/api/v2/media', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const mediaId = mediaResp.data.id;
      await apiRequestPost<MomentResponse>('v1/moments', {
        media_attachment_id: mediaId,
        voice_media_attachment_id: primaryIsStill ? voice?.mediaId : null,
        caption: caption.trim(),
        visibility,
        krew_id: visibility === 'krew' ? krewId : null,
      });
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
    }
  }, [
    file,
    primaryIsStill,
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
          {file ? (
            <div className='moments-composer__file-summary'>{file.name}</div>
          ) : (
            <MediaPickButtons
              onPick={onFileChange}
              className='moments-composer__pick'
            />
          )}
        </section>

        {primaryIsStill && (
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
            disabled={!file || posting || (visibility === 'krew' && !krewId)}
          >
            {posting ? (
              <FormattedMessage
                id='moments.composer.posting'
                defaultMessage='Sharing…'
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
