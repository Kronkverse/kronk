// Moments composer — image-first. The picked media IS the composer: a
// full-size hero preview with the media filling the frame, a thumbnail
// filmstrip to move between shots, and a caption below. The empty state
// offers three peers — Camera, Upload, Voice — and the trailing "+" on
// the strip adds more.
//
// Each tile in the strip posts as its own Moment, all sharing the one
// caption / visibility / krew:
//   • a photo / video tile → a media Moment (POST v2/media → v1/moments
//     with media_attachment_id)
//   • a voice tile → a voice-only Moment (voice_media_attachment_id,
//     no photo) — enabled back-end 2026-08-09.
//
// Still photos can carry text overlays (the hero "Aa" tool opens the
// editor); videos and voice clips cannot. The cross-korner attach flows
// (Kalendar / Krew / Map / Klot / mARTketplace) declared in the spec are
// not shipped in v1 — they land in follow-ups.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { FormattedMessage, useIntl, defineMessages } from 'react-intl';

import axios from 'axios';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import AddPhotoAlternateIcon from '@/material-icons/400-24px/add_photo_alternate.svg?react';
import ChevronLeftIcon from '@/material-icons/400-24px/chevron_left.svg?react';
import ChevronRightIcon from '@/material-icons/400-24px/chevron_right.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import MicIcon from '@/material-icons/400-24px/mic.svg?react';
import PersonAddIcon from '@/material-icons/400-24px/person_add.svg?react';
import PhotoCameraIcon from '@/material-icons/400-24px/photo_camera.svg?react';
import api, { apiRequestPost } from 'mastodon/api';
import { apiAddMediaTag } from 'mastodon/api/media_tags';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { Icon } from 'mastodon/components/icon';
import { KornerKrewPicker } from 'mastodon/components/korner_krew_picker';
import { VoiceRecorder, uploadMediaBlob } from 'mastodon/components/media';
import type { VoiceRecorderChange } from 'mastodon/components/media';
import type { ReachValue } from 'mastodon/components/reach_dropdown';
import { ReachDropdown } from 'mastodon/components/reach_dropdown';

import { MomentsTagPeoplePanel } from './tag_people_panel';
import type { TaggedAccountLite } from './tag_people_panel';
import { MomentsTextEditor } from './text_editor';
import type { TextOverlay } from './text_overlay';
import { OverlayLayer } from './text_overlay';

// Reach ladder + krew (docs/kronk_feed_and_reach.md §2), minus
// `self_only` — an audience-of-one on an ephemeral share is a private
// journal, not a Moment (docs/spaces/moments.md § Reach).
type Visibility = 'public' | 'orbit' | 'mates' | 'krew';

// One tile in the strip. A media tile wraps a picked File (photo or
// video); a voice tile wraps a recorded clip. `url` is an object URL
// for preview, revoked on removal / unmount.
interface MediaItem {
  kind: 'media';
  file: File;
  url: string;
  isVideo: boolean;
  overlays: TextOverlay[];
  // People tagged on this photo. Empty for videos (the picker UI is
  // hidden for those, matching the text-overlay treatment). Sent to
  // the server as apiAddMediaTag calls after the media upload
  // succeeds — the mediaId only exists at submit time.
  taggedAccounts: TaggedAccountLite[];
}
interface VoiceItem {
  kind: 'voice';
  change: VoiceRecorderChange;
}
type Item = MediaItem | VoiceItem;

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

const isStill = (item: Item): item is MediaItem =>
  item.kind === 'media' && !item.isVideo;

export const MomentsComposer = ({ onClose, onPosted }: Props) => {
  const intl = useIntl();
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState(0);
  // Stage modes: the voice recorder takes over the hero while arming /
  // recording; `addMenu` is the little Camera/Upload/Voice popover the
  // strip's "+" opens.
  const [recording, setRecording] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [editorIndex, setEditorIndex] = useState<number | null>(null);
  const [tagPickerIndex, setTagPickerIndex] = useState<number | null>(null);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('mates');
  const [krewId, setKrewId] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [postingProgress, setPostingProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
  // Object URLs currently held, so unmount can revoke every one even if
  // React has already dropped the item from state.
  const urlsRef = useRef<Set<string>>(new Set());

  useEffect(
    () => () => {
      urlsRef.current.forEach((u) => {
        URL.revokeObjectURL(u);
      });
    },
    [],
  );

  const appendFiles = useCallback(
    (picked: File[]) => {
      if (picked.length === 0) return;
      const added: MediaItem[] = picked.map((file) => {
        const url = URL.createObjectURL(file);
        urlsRef.current.add(url);
        return {
          kind: 'media',
          file,
          url,
          isVideo: file.type.startsWith('video/'),
          overlays: [],
          taggedAccounts: [],
        };
      });
      setActive(items.length); // focus the first newly-added tile
      setItems((prev) => [...prev, ...added]);
    },
    [items.length],
  );

  const onCameraChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      appendFiles(Array.from(event.target.files ?? []));
      event.target.value = '';
    },
    [appendFiles],
  );
  const onLibraryChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      appendFiles(Array.from(event.target.files ?? []));
      event.target.value = '';
    },
    [appendFiles],
  );

  const openCamera = useCallback(() => {
    setAddMenuOpen(false);
    cameraInputRef.current?.click();
  }, []);
  const openLibrary = useCallback(() => {
    setAddMenuOpen(false);
    libraryInputRef.current?.click();
  }, []);
  const startVoice = useCallback(() => {
    setAddMenuOpen(false);
    setRecording(true);
  }, []);
  const cancelVoice = useCallback(() => {
    setRecording(false);
  }, []);

  // Recorder handed back a finished clip (autoUpload off → blob only);
  // append it as a voice tile and leave recording mode.
  const onVoiceChange = useCallback(
    (change: VoiceRecorderChange | null) => {
      if (!change?.blob) return;
      setActive(items.length);
      setItems((prev) => [...prev, { kind: 'voice', change }]);
      setRecording(false);
    },
    [items.length],
  );

  const toggleAddMenu = useCallback(() => {
    setAddMenuOpen((v) => !v);
  }, []);

  // Drop a tile; the `active` clamp effect below re-homes the cursor.
  const removeAt = useCallback((index: number) => {
    setItems((prev) => {
      const target = prev[index];
      if (target?.kind === 'media') {
        URL.revokeObjectURL(target.url);
        urlsRef.current.delete(target.url);
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const removeActive = useCallback(() => {
    removeAt(active);
  }, [removeAt, active]);

  const goPrev = useCallback(() => {
    setActive((a) => Math.max(0, a - 1));
  }, []);
  const goNext = useCallback(() => {
    setActive((a) => a + 1);
  }, []);

  // Clamp `active` if the tail was removed elsewhere.
  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, items.length - 1)));
  }, [items.length]);

  // Keyboard left / right moves between tiles (only when the strip has
  // more than one and no modal / recorder is capturing input).
  useEffect(() => {
    if (items.length < 2 || editorIndex !== null || recording) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, a - 1));
      if (e.key === 'ArrowRight')
        setActive((a) => Math.min(items.length - 1, a + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [items.length, editorIndex, recording]);

  // ── text overlay editor ──────────────────────────────────────────
  const openEditorActive = useCallback(() => {
    setEditorIndex(active);
  }, [active]);
  const closeEditor = useCallback(() => {
    setEditorIndex(null);
  }, []);
  const handleEditorCommit = useCallback((overlays: TextOverlay[]) => {
    setEditorIndex((cur) => {
      if (cur === null) return null;
      setItems((prev) => {
        const next = [...prev];
        const target = next[cur];
        if (target && target.kind === 'media') {
          next[cur] = { ...target, overlays };
        }
        return next;
      });
      return null;
    });
  }, []);

  // ── tag-people picker ────────────────────────────────────────────
  const openTagPickerActive = useCallback(() => {
    setTagPickerIndex(active);
  }, [active]);
  const closeTagPicker = useCallback(() => {
    setTagPickerIndex(null);
  }, []);
  const handleTagsCommit = useCallback((tagged: TaggedAccountLite[]) => {
    setTagPickerIndex((cur) => {
      if (cur === null) return null;
      setItems((prev) => {
        const next = [...prev];
        const target = next[cur];
        if (target && target.kind === 'media') {
          next[cur] = { ...target, taggedAccounts: tagged };
        }
        return next;
      });
      return cur;
    });
  }, []);

  const onCaptionChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCaption(event.target.value.slice(0, MAX_CAPTION_LENGTH));
    },
    [],
  );

  const onReachChange = useCallback((next: ReachValue) => {
    setVisibility(next as Visibility);
    if (next !== 'krew') setKrewId(null);
  }, []);

  const uploadFile = useCallback(async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    // `api()` has no baseURL, so the raw axios instance needs the
    // absolute `/api/…` path (the apiRequest* helpers prepend it).
    const resp = await api().post<MediaResponse>('/api/v2/media', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return resp.data.id;
  }, []);

  const submitAsync = useCallback(async () => {
    if (items.length === 0 || posting) return;
    setPosting(true);
    setPostingProgress({ current: 0, total: items.length });
    setError(null);
    const trimmedCaption = caption.trim();
    const krewIdOrNull = visibility === 'krew' ? krewId : null;
    try {
      for (const [i, item] of items.entries()) {
        setPostingProgress({ current: i + 1, total: items.length });
        if (item.kind === 'voice') {
          const blob = item.change.blob;
          if (!blob) continue;
          // uploadMediaBlob owns the audio extension-vs-MIME dance
          // (WebM must be declared video/webm or Paperclip 422s the
          // spoof check) — the same helper the recorder uses.
          const voiceId = item.change.mediaId ?? (await uploadMediaBlob(blob));
          await apiRequestPost<MomentResponse>('v1/moments', {
            voice_media_attachment_id: voiceId,
            caption: trimmedCaption,
            visibility,
            krew_id: krewIdOrNull,
          });
        } else {
          const mediaId = await uploadFile(item.file);
          // Post any tagged accounts against the freshly-uploaded
          // media BEFORE creating the Moment. Doing it after would
          // race with the Moment's `media_tag` notification pass in
          // MomentsController#create — we want the tags in place so
          // the pass sees them. Failures per-tag are logged and
          // continued (a single flaky account lookup shouldn't drop
          // the whole Moment) — sequential so 5 tags don't slam the
          // endpoint.
          if (!item.isVideo && item.taggedAccounts.length > 0) {
            for (const tag of item.taggedAccounts) {
              try {
                // Centre coord for now; positional tap-to-place is a
                // follow-up (Instagram Stories-style). The server clamps
                // to [0, 1] regardless.
                await apiAddMediaTag(mediaId, tag.accountId, 0.5, 0.5);
              } catch (e) {
                console.warn('media tag failed', tag.acct, e);
              }
            }
          }
          await apiRequestPost<MomentResponse>('v1/moments', {
            media_attachment_id: mediaId,
            caption: trimmedCaption,
            visibility,
            krew_id: krewIdOrNull,
            text_overlays: item.isVideo ? [] : item.overlays,
          });
        }
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
  }, [items, caption, visibility, krewId, posting, onPosted, uploadFile]);

  // ESLint no-misused-promises wants a void-returning handler.
  const submit = useCallback(() => {
    void submitAsync();
  }, [submitAsync]);

  // Editor labels: index / total are over still photos only (voice +
  // video tiles don't take overlays and aren't counted).
  const stillIndexes = useMemo(
    () => items.map((it, i) => (isStill(it) ? i : -1)).filter((i) => i >= 0),
    [items],
  );
  const editorTarget = editorIndex !== null ? items[editorIndex] : undefined;
  const tagPickerTarget =
    tagPickerIndex !== null ? items[tagPickerIndex] : undefined;

  const submitLabel =
    items.length > 1
      ? intl.formatMessage(shellMessages.postMulti, { count: items.length })
      : intl.formatMessage(shellMessages.post);
  const submittingLabel =
    postingProgress && postingProgress.total > 1
      ? intl.formatMessage(shellMessages.postingMulti, {
          current: postingProgress.current,
          total: postingProgress.total,
        })
      : intl.formatMessage(shellMessages.posting);
  const canSubmit =
    items.length > 0 && (visibility !== 'krew' || krewId !== null);

  const reachControl = (
    <ReachDropdown
      value={visibility as ReachValue}
      onChange={onReachChange}
      hide={['self_only']}
      disabled={posting}
    />
  );

  const activeItem = items[active];

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

          {/* hidden file inputs, driven by the picker + strip "+" */}
          <input
            ref={cameraInputRef}
            className='moments-composer__file-input'
            type='file'
            accept='image/*,video/*'
            capture='environment'
            onChange={onCameraChange}
          />
          <input
            ref={libraryInputRef}
            className='moments-composer__file-input'
            type='file'
            accept='image/*,video/*'
            multiple
            onChange={onLibraryChange}
          />

          <div className='moments-composer__stage'>
            {recording ? (
              <div className='moments-composer__recorder'>
                <VoiceRecorder
                  onChange={onVoiceChange}
                  autoUpload={false}
                  maxSeconds={VOICE_MAX_SECONDS}
                  disabled={posting}
                />
                <button
                  type='button'
                  className='moments-composer__recorder-cancel'
                  onClick={cancelVoice}
                >
                  <FormattedMessage
                    id='moments.composer.cancel_voice'
                    defaultMessage='Cancel'
                  />
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className='moments-composer__picker'>
                <PickChoice
                  iconId='photo_camera'
                  icon={PhotoCameraIcon}
                  label={intl.formatMessage(messages.camera)}
                  onClick={openCamera}
                />
                <PickChoice
                  iconId='add_photo_alternate'
                  icon={AddPhotoAlternateIcon}
                  label={intl.formatMessage(messages.upload)}
                  onClick={openLibrary}
                />
                <PickChoice
                  iconId='mic'
                  icon={MicIcon}
                  label={intl.formatMessage(messages.voice)}
                  onClick={startVoice}
                />
              </div>
            ) : (
              activeItem && (
                <Hero
                  item={activeItem}
                  index={active}
                  total={items.length}
                  disabled={posting}
                  onEdit={openEditorActive}
                  onTagPeople={openTagPickerActive}
                  onRemove={removeActive}
                  onPrev={active > 0 ? goPrev : undefined}
                  onNext={active < items.length - 1 ? goNext : undefined}
                />
              )
            )}
          </div>

          {items.length > 0 && (
            <div className='moments-composer__strip'>
              {items.map((item, i) => (
                <Thumb
                  key={
                    item.kind === 'media' ? item.url : `voice-${i.toString()}`
                  }
                  index={i}
                  item={item}
                  active={i === active}
                  disabled={posting}
                  onSelect={setActive}
                  onRemove={removeAt}
                />
              ))}
              <div className='moments-composer__add'>
                <button
                  type='button'
                  className='moments-composer__add-tile'
                  onClick={toggleAddMenu}
                  disabled={posting}
                  aria-label={intl.formatMessage(messages.addMore)}
                  aria-expanded={addMenuOpen}
                >
                  <Icon id='add' icon={AddIcon} />
                </button>
                {addMenuOpen && (
                  <div className='moments-composer__add-menu'>
                    <AddMenuItem
                      iconId='photo_camera'
                      icon={PhotoCameraIcon}
                      label={intl.formatMessage(messages.camera)}
                      onClick={openCamera}
                    />
                    <AddMenuItem
                      iconId='add_photo_alternate'
                      icon={AddPhotoAlternateIcon}
                      label={intl.formatMessage(messages.upload)}
                      onClick={openLibrary}
                    />
                    <AddMenuItem
                      iconId='mic'
                      icon={MicIcon}
                      label={intl.formatMessage(messages.voice)}
                      onClick={startVoice}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {items.length > 0 && (
            <textarea
              id='moments-composer-caption'
              className='moments-composer__caption'
              value={caption}
              onChange={onCaptionChange}
              maxLength={MAX_CAPTION_LENGTH}
              rows={2}
              placeholder={intl.formatMessage(messages.captionPlaceholder)}
            />
          )}

          {error && <div className='moments-composer__error'>{error}</div>}
        </div>
      </ComposeShell>

      {editorIndex !== null &&
        editorTarget &&
        editorTarget.kind === 'media' && (
          <MomentsTextEditor
            file={editorTarget.file}
            initial={editorTarget.overlays}
            index={Math.max(0, stillIndexes.indexOf(editorIndex))}
            total={stillIndexes.length}
            onCancel={closeEditor}
            onCommit={handleEditorCommit}
          />
        )}

      {tagPickerIndex !== null &&
        tagPickerTarget &&
        tagPickerTarget.kind === 'media' &&
        !tagPickerTarget.isVideo && (
          <MomentsTagPeoplePanel
            initial={tagPickerTarget.taggedAccounts}
            onSave={handleTagsCommit}
            onClose={closeTagPicker}
          />
        )}
    </>
  );
};

// ── empty-state choice: a big icon disc + label ────────────────────
const PickChoice: React.FC<{
  iconId: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  label: string;
  onClick: () => void;
}> = ({ iconId, icon, label, onClick }) => (
  <button type='button' className='moments-composer__choice' onClick={onClick}>
    <span className='moments-composer__choice-disc'>
      <Icon id={iconId} icon={icon} />
    </span>
    {label}
  </button>
);

// ── strip "+" menu row ─────────────────────────────────────────────
const AddMenuItem: React.FC<{
  iconId: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  label: string;
  onClick: () => void;
}> = ({ iconId, icon, label, onClick }) => (
  <button
    type='button'
    className='moments-composer__add-menu-item'
    onClick={onClick}
  >
    <Icon id={iconId} icon={icon} />
    {label}
  </button>
);

// ── full-size hero of the active tile ──────────────────────────────
const Hero: React.FC<{
  item: Item;
  index: number;
  total: number;
  disabled: boolean;
  onEdit: () => void;
  onTagPeople: () => void;
  onRemove: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}> = ({
  item,
  index,
  total,
  disabled,
  onEdit,
  onTagPeople,
  onRemove,
  onPrev,
  onNext,
}) => {
  const intl = useIntl();
  return (
    <div className='moments-composer__hero'>
      {item.kind === 'voice' ? (
        <div className='moments-composer__hero-voice'>
          <Icon id='mic' icon={MicIcon} />
          <span className='moments-composer__hero-voice-label'>
            <FormattedMessage
              id='moments.composer.voice_clip'
              defaultMessage='Voice · {seconds}s'
              values={{ seconds: Math.round(item.change.seconds) }}
            />
          </span>
        </div>
      ) : item.isVideo ? (
        <video
          className='moments-composer__hero-media'
          src={item.url}
          controls
          muted
          playsInline
        />
      ) : (
        <>
          <img
            className='moments-composer__hero-media'
            src={item.url}
            alt=''
            aria-hidden
          />
          <OverlayLayer overlays={item.overlays} />
        </>
      )}

      <span className='moments-composer__hero-badge'>
        {item.kind === 'voice'
          ? intl.formatMessage(messages.voice)
          : `${(index + 1).toString()} / ${total.toString()}`}
      </span>

      <div className='moments-composer__hero-tools'>
        {isStill(item) && (
          <button
            type='button'
            className='moments-composer__hero-tool'
            onClick={onEdit}
            disabled={disabled}
            aria-label={intl.formatMessage(
              item.overlays.length > 0 ? messages.editText : messages.addText,
            )}
          >
            <EditIcon />
          </button>
        )}
        {isStill(item) && (
          <button
            type='button'
            className='moments-composer__hero-tool'
            onClick={onTagPeople}
            disabled={disabled}
            aria-label={intl.formatMessage(
              item.taggedAccounts.length > 0
                ? messages.editTags
                : messages.addTags,
            )}
          >
            <PersonAddIcon />
            {item.taggedAccounts.length > 0 && (
              <span className='moments-composer__hero-tool-count'>
                {item.taggedAccounts.length}
              </span>
            )}
          </button>
        )}
        <button
          type='button'
          className='moments-composer__hero-tool'
          onClick={onRemove}
          disabled={disabled}
          aria-label={intl.formatMessage(messages.remove)}
        >
          <CloseIcon />
        </button>
      </div>

      {onPrev && (
        <button
          type='button'
          className='moments-composer__hero-nav moments-composer__hero-nav--prev'
          onClick={onPrev}
          aria-label={intl.formatMessage(messages.previous)}
        >
          <ChevronLeftIcon />
        </button>
      )}
      {onNext && (
        <button
          type='button'
          className='moments-composer__hero-nav moments-composer__hero-nav--next'
          onClick={onNext}
          aria-label={intl.formatMessage(messages.next)}
        >
          <ChevronRightIcon />
        </button>
      )}

      {total > 1 && (
        <div className='moments-composer__hero-dots' aria-hidden>
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={
                i === index
                  ? 'moments-composer__hero-dot moments-composer__hero-dot--on'
                  : 'moments-composer__hero-dot'
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ── filmstrip thumbnail ────────────────────────────────────────────
const Thumb: React.FC<{
  index: number;
  item: Item;
  active: boolean;
  disabled: boolean;
  onSelect: (i: number) => void;
  onRemove: (i: number) => void;
}> = ({ index, item, active, disabled, onSelect, onRemove }) => {
  const intl = useIntl();
  const handleSelect = useCallback(() => {
    onSelect(index);
  }, [onSelect, index]);
  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove(index);
    },
    [onRemove, index],
  );
  return (
    <div
      className={
        active
          ? 'moments-composer__thumb moments-composer__thumb--active'
          : 'moments-composer__thumb'
      }
    >
      <button
        type='button'
        className='moments-composer__thumb-face'
        onClick={handleSelect}
        aria-label={intl.formatMessage(messages.selectTile, {
          n: index + 1,
        })}
      >
        {item.kind === 'voice' ? (
          <span className='moments-composer__thumb-voice'>
            <Icon id='mic' icon={MicIcon} />
          </span>
        ) : item.isVideo ? (
          <video
            className='moments-composer__thumb-media'
            src={item.url}
            muted
          />
        ) : (
          <img
            className='moments-composer__thumb-media'
            src={item.url}
            alt=''
            aria-hidden
          />
        )}
      </button>
      <button
        type='button'
        className='moments-composer__thumb-remove'
        onClick={handleRemove}
        disabled={disabled}
        aria-label={intl.formatMessage(messages.remove)}
      >
        <CloseIcon />
      </button>
    </div>
  );
};

const messages = defineMessages({
  camera: { id: 'moments.composer.camera', defaultMessage: 'Camera' },
  upload: { id: 'moments.composer.upload', defaultMessage: 'Upload' },
  voice: { id: 'moments.composer.voice_label', defaultMessage: 'Voice' },
  addMore: { id: 'moments.composer.add_more', defaultMessage: 'Add more' },
  addText: { id: 'moments.composer.add_text', defaultMessage: 'Add text' },
  editText: { id: 'moments.composer.edit_text', defaultMessage: 'Edit text' },
  addTags: {
    id: 'moments.composer.add_tags',
    defaultMessage: 'Tag people',
  },
  editTags: {
    id: 'moments.composer.edit_tags',
    defaultMessage: 'Edit tagged people',
  },
  remove: { id: 'moments.composer.remove', defaultMessage: 'Remove' },
  previous: { id: 'moments.composer.previous', defaultMessage: 'Previous' },
  next: { id: 'moments.composer.next', defaultMessage: 'Next' },
  selectTile: {
    id: 'moments.composer.select_tile',
    defaultMessage: 'Show item {n}',
  },
  captionPlaceholder: {
    id: 'moments.composer.caption_placeholder',
    defaultMessage: 'Say something about this Moment…',
  },
});

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
    defaultMessage: 'Sharing…',
  },
  postingMulti: {
    id: 'moments.composer.posting_multi',
    defaultMessage: 'Sharing {current} of {total}…',
  },
});
