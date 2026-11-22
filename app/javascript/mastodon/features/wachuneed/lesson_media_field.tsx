import { useCallback, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import HeadphonesIcon from '@/material-icons/400-24px/headphones.svg?react';
import MovieIcon from '@/material-icons/400-24px/movie.svg?react';
import PhotoIcon from '@/material-icons/400-24px/photo.svg?react';
import UploadFileIcon from '@/material-icons/400-24px/upload_file.svg?react';
import { apiUploadListingMedia } from 'mastodon/api/wachuneed';
import type { ApiLessonMediaJSON } from 'mastodon/api_types/wachuneed';
import { Icon } from 'mastodon/components/icon';

// What a lesson teaches with (docs/spaces/wachuneed.md, Lessons): videos,
// recordings and pictures, in order, uploaded as the photos are. Each row
// is its kind's icon and its name; nothing here is a photo, and none of it
// shows on the card or in the feed.

const MAX_LESSON_MEDIA = 20;

type LessonMediaKind = ApiLessonMediaJSON['type'];

interface LessonSlot {
  key: string;
  id: string | null;
  kind: LessonMediaKind;
  name: string;
}

const messages = defineMessages({
  add: {
    id: 'wachuneed.lesson.field.add',
    defaultMessage: 'Add videos, recordings or pictures',
  },
  remove: { id: 'wachuneed.lesson.field.remove', defaultMessage: 'Take off' },
  uploading: {
    id: 'wachuneed.lesson.field.uploading',
    defaultMessage: 'Uploading…',
  },
  error: {
    id: 'wachuneed.lesson.field.error',
    defaultMessage: "Couldn't upload that. Try another?",
  },
  video: { id: 'wachuneed.lesson.field.video', defaultMessage: 'Video' },
  audio: { id: 'wachuneed.lesson.field.audio', defaultMessage: 'Recording' },
  image: { id: 'wachuneed.lesson.field.image', defaultMessage: 'Picture' },
});

const kindOf = (type: string): LessonMediaKind =>
  type.startsWith('video') || type === 'gifv'
    ? 'video'
    : type.startsWith('audio')
      ? 'audio'
      : type.startsWith('image')
        ? 'image'
        : 'unknown';

const KIND_ICON = {
  video: MovieIcon,
  audio: HeadphonesIcon,
  image: PhotoIcon,
  unknown: UploadFileIcon,
} as const;

export interface LessonMediaState {
  slots: LessonSlot[];
  error: string | null;
  touched: boolean;
  uploading: boolean;
  ids: string[];
  load: (saved: ApiLessonMediaJSON[]) => void;
  handleAdd: React.ChangeEventHandler<HTMLInputElement>;
  handleRemove: React.MouseEventHandler<HTMLButtonElement>;
}

export const useLessonMedia = (): LessonMediaState => {
  const intl = useIntl();
  const [slots, setSlots] = useState<LessonSlot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const nextKey = useRef(0);

  const kindName = useCallback(
    (kind: LessonMediaKind) =>
      intl.formatMessage(
        kind === 'audio'
          ? messages.audio
          : kind === 'image'
            ? messages.image
            : messages.video,
      ),
    [intl],
  );

  const load = useCallback(
    (saved: ApiLessonMediaJSON[]) => {
      setSlots(
        saved.map((media, index) => ({
          key: `saved-${media.id}`,
          id: media.id,
          kind: media.type,
          name: media.description ?? `${kindName(media.type)} ${index + 1}`,
        })),
      );
      setError(null);
      setTouched(false);
    },
    [kindName],
  );

  const uploadError = intl.formatMessage(messages.error);
  const handleAdd = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      const room = MAX_LESSON_MEDIA - slots.length;
      const files = Array.from(e.currentTarget.files ?? []).slice(0, room);
      e.currentTarget.value = '';
      if (files.length === 0) return;

      setTouched(true);
      setError(null);

      const added = files.map((file) => {
        nextKey.current += 1;
        return {
          file,
          slot: {
            key: `new-${nextKey.current}`,
            id: null,
            kind: kindOf(file.type),
            name: file.name,
          } satisfies LessonSlot,
        };
      });
      setSlots((prev) => [...prev, ...added.map((a) => a.slot)]);

      added.forEach(({ file, slot }) => {
        apiUploadListingMedia(file)
          .then((media) => {
            setSlots((prev) =>
              prev.map((s) =>
                s.key === slot.key ? { ...s, id: media.id } : s,
              ),
            );
            return undefined;
          })
          .catch(() => {
            setSlots((prev) => prev.filter((s) => s.key !== slot.key));
            setError(uploadError);
          });
      });
    },
    [slots.length, uploadError],
  );

  const handleRemove = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
    (e) => {
      const key = e.currentTarget.dataset.key;
      setTouched(true);
      setSlots((prev) => prev.filter((s) => s.key !== key));
    },
    [],
  );

  return {
    slots,
    error,
    touched,
    uploading: slots.some((s) => s.id === null),
    ids: slots.flatMap((s) => (s.id ? [s.id] : [])),
    load,
    handleAdd,
    handleRemove,
  };
};

export const LessonMediaField: React.FC<{ state: LessonMediaState }> = ({
  state,
}) => {
  const intl = useIntl();

  return (
    <div className='wachuneed-lesson-media'>
      {state.slots.length > 0 && (
        <ul className='wachuneed-lesson-media__list'>
          {state.slots.map((slot) => (
            <li key={slot.key} className='wachuneed-lesson-media__row'>
              <Icon
                id={slot.kind}
                icon={KIND_ICON[slot.kind]}
                className='wachuneed-lesson-media__glyph'
              />
              <span className='wachuneed-lesson-media__name'>
                {slot.id
                  ? slot.name
                  : `${slot.name} · ${intl.formatMessage(messages.uploading)}`}
              </span>
              <button
                type='button'
                className='wachuneed-lesson-media__remove'
                data-key={slot.key}
                onClick={state.handleRemove}
                aria-label={intl.formatMessage(messages.remove)}
                title={intl.formatMessage(messages.remove)}
              >
                <Icon id='close' icon={CloseIcon} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {state.slots.length < MAX_LESSON_MEDIA && (
        <label className='wachuneed-lesson-media__pick'>
          <Icon id='upload' icon={UploadFileIcon} />
          <span>{intl.formatMessage(messages.add)}</span>
          <input
            type='file'
            accept='video/*,audio/*,image/*'
            multiple
            onChange={state.handleAdd}
            className='wachuneed-lesson-media__input'
          />
        </label>
      )}
      {state.error && (
        <p className='wachuneed__compose-error' role='alert'>
          {state.error}
        </p>
      )}
    </div>
  );
};
