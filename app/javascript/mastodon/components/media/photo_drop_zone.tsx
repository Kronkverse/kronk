import type { ChangeEvent, DragEvent } from 'react';
import { useCallback, useId, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import classNames from 'classnames';

import AddPhotoAlternateIcon from '@/material-icons/400-24px/add_photo_alternate.svg?react';
import { Icon } from 'mastodon/components/icon';

const messages = defineMessages({
  pick: {
    id: 'photo_drop_zone.pick',
    defaultMessage: 'Drag photos here, or click to choose',
  },
  pickOne: {
    id: 'photo_drop_zone.pick_one',
    defaultMessage: 'Drag a photo here, or click to choose',
  },
  drop: { id: 'photo_drop_zone.drop', defaultMessage: 'Drop to add' },
});

interface PhotoDropZoneProps {
  // The picked or dropped files, already filtered to `accept`. Never empty.
  onFiles: (files: File[]) => void;
  // The input's accept list. Dropped files are held to it too, since a
  // drag can carry anything (a text file, a link).
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  // Replaces the default "Drag photos here, or click to choose".
  label?: React.ReactNode;
  className?: string;
}

// Does a file match an accept list like 'image/*,video/mp4,.heic'?
const accepts = (file: File, accept: string): boolean =>
  accept
    .split(',')
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean)
    .some((a) => {
      if (a.startsWith('.')) return file.name.toLowerCase().endsWith(a);
      if (a.endsWith('/*')) return file.type.startsWith(a.slice(0, -1));
      return file.type === a;
    });

// The one way to add photos (docs/design.md, Compose + confirmation): a box
// you can drop photos on from the desktop, or click to choose them. Every
// photo upload uses it, so drag and drop works everywhere.
//
// A drop here is marked handled (preventDefault), so the window-level drop
// in features/ui/index.jsx leaves it alone instead of also uploading the
// files into the main post box.
export const PhotoDropZone: React.FC<PhotoDropZoneProps> = ({
  onFiles,
  accept = 'image/*',
  multiple = true,
  disabled = false,
  label,
  className,
}) => {
  const intl = useIntl();
  const inputId = useId();
  const [dragging, setDragging] = useState(false);

  const take = useCallback(
    (list: FileList | null) => {
      const files = Array.from(list ?? []).filter((f) => accepts(f, accept));
      const picked = multiple ? files : files.slice(0, 1);
      if (picked.length > 0) onFiles(picked);
    },
    [accept, multiple, onFiles],
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      take(e.target.files);
      // So picking the same file again fires again.
      e.target.value = '';
    },
    [take],
  );

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      if (!disabled) setDragging(true);
    },
    [disabled],
  );
  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);
  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (!disabled) take(e.dataTransfer.files);
    },
    [disabled, take],
  );

  return (
    <div
      className={classNames('photo-drop-zone', className, {
        'photo-drop-zone--dragging': dragging,
        'photo-drop-zone--disabled': disabled,
      })}
      onDragEnter={handleDragOver}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        id={inputId}
        type='file'
        className='photo-drop-zone__input'
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={handleChange}
      />
      <label htmlFor={inputId} className='photo-drop-zone__label'>
        <Icon
          id='add_photo_alternate'
          icon={AddPhotoAlternateIcon}
          className='photo-drop-zone__icon'
        />
        <span className='photo-drop-zone__text'>
          {dragging
            ? intl.formatMessage(messages.drop)
            : (label ??
              intl.formatMessage(multiple ? messages.pick : messages.pickOne))}
        </span>
      </label>
    </div>
  );
};
