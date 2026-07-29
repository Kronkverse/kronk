// Moments composer — v1 slice. Uploads one media attachment, adds an
// optional caption, picks a visibility, posts. The cross-korner
// attach flows (Kalendar / Krew / Map / Klot / mARTketplace)
// declared in docs/spaces/moments.md are not shipped in v1; they
// land in a follow-up.
//
// Media upload flow: POST /api/v1/media (multipart) → get the
// attachment id → POST /api/v1/moments with { media_attachment_id,
// caption, visibility }.

import type { ChangeEvent } from 'react';
import { useCallback, useRef, useState } from 'react';

import { FormattedMessage } from 'react-intl';

import axios from 'axios';

import api, { apiRequestPost } from 'mastodon/api';

// Full four-tier ladder + krew (docs/kronk_feed_and_reach.md §2).
// `krew` remains out of reach in the composer until the krew picker
// lands; the button is present for parity but disabled.
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

export const MomentsComposer = ({ onClose, onPosted }: Props) => {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('mates');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
  }, []);

  const onCaptionChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      setCaption(event.target.value.slice(0, MAX_CAPTION_LENGTH));
    },
    [],
  );

  const onVisibilityPublic = useCallback(() => {
    setVisibility('public');
  }, []);
  const onVisibilityOrbit = useCallback(() => {
    setVisibility('orbit');
  }, []);
  const onVisibilityMates = useCallback(() => {
    setVisibility('mates');
  }, []);
  const onVisibilitySelfOnly = useCallback(() => {
    setVisibility('self_only');
  }, []);

  const submitAsync = useCallback(async () => {
    if (!file || posting) return;
    setPosting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const mediaResp = await api().post<MediaResponse>('v1/media', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const mediaId = mediaResp.data.id;
      await apiRequestPost<MomentResponse>('v1/moments', {
        media_attachment_id: mediaId,
        caption: caption.trim(),
        visibility,
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
  }, [file, caption, visibility, posting, onPosted]);

  // ESLint no-misused-promises wants a void-returning handler; wrap
  // the async so the promise is dropped intentionally.
  const submit = useCallback(() => {
    void submitAsync();
  }, [submitAsync]);

  const chooseFile = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return (
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
          <label
            className='moments-composer__label'
            htmlFor='moments-composer-file'
          >
            <FormattedMessage
              id='moments.composer.media'
              defaultMessage='Media'
            />
          </label>
          <input
            ref={inputRef}
            id='moments-composer-file'
            className='moments-composer__file'
            type='file'
            accept='image/*,video/*'
            onChange={onFileChange}
          />
          {file ? (
            <div className='moments-composer__file-summary'>{file.name}</div>
          ) : (
            <button
              type='button'
              className='moments-composer__file-picker'
              onClick={chooseFile}
            >
              <FormattedMessage
                id='moments.composer.pick_media'
                defaultMessage='Choose a photo or video'
              />
            </button>
          )}
        </section>

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
          <div className='moments-composer__visibility'>
            <button
              type='button'
              onClick={onVisibilityPublic}
              className={`moments-composer__vis-btn${visibility === 'public' ? ' moments-composer__vis-btn--active' : ''}`}
              aria-label='Kronk — everyone on Kronk'
            >
              <FormattedMessage
                id='moments.composer.public'
                defaultMessage='Kronk'
              />
            </button>
            <button
              type='button'
              onClick={onVisibilityOrbit}
              className={`moments-composer__vis-btn${visibility === 'orbit' ? ' moments-composer__vis-btn--active' : ''}`}
              aria-label='Orbit — your mates and their mates'
            >
              <FormattedMessage
                id='moments.composer.orbit'
                defaultMessage='Orbit'
              />
            </button>
            <button
              type='button'
              onClick={onVisibilityMates}
              className={`moments-composer__vis-btn${visibility === 'mates' ? ' moments-composer__vis-btn--active' : ''}`}
              aria-label='Mates — your mutual connections only'
            >
              <FormattedMessage
                id='moments.composer.mates'
                defaultMessage='Mates'
              />
            </button>
            <button
              type='button'
              onClick={onVisibilitySelfOnly}
              className={`moments-composer__vis-btn${visibility === 'self_only' ? ' moments-composer__vis-btn--active' : ''}`}
              aria-label='Just me — on your profile only, not in anyone else’s feed'
            >
              <FormattedMessage
                id='moments.composer.self_only'
                defaultMessage='Just me'
              />
            </button>
          </div>
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
            disabled={!file || posting}
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
    </div>
  );
};
