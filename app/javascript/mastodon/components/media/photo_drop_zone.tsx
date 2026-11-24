import type { ChangeEvent } from 'react';
import { useCallback, useId } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import classNames from 'classnames';

import AddPhotoAlternateIcon from '@/material-icons/400-24px/add_photo_alternate.svg?react';
import { Icon } from 'mastodon/components/icon';
import { usePhotoDrop } from 'mastodon/hooks/usePhotoDrop';

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
  // The input's id, for a spec or an outside <label> to find it by.
  id?: string;
}

// The one way to add photos (docs/design.md, Compose + confirmation): a box
// you can drop photos on from the desktop, or click to choose them. The
// drop itself is usePhotoDrop, which places that already have a look of
// their own (an avatar, a cover) use directly.
export const PhotoDropZone: React.FC<PhotoDropZoneProps> = ({
  onFiles,
  accept = 'image/*',
  multiple = true,
  disabled = false,
  label,
  className,
  id,
}) => {
  const intl = useIntl();
  const autoId = useId();
  const inputId = id ?? autoId;
  const { dragging, dropProps, take } = usePhotoDrop({
    onFiles,
    accept,
    multiple,
    disabled,
  });

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      take(e.target.files);
      // So picking the same file again fires again.
      e.target.value = '';
    },
    [take],
  );

  return (
    <div
      className={classNames('photo-drop-zone', className, {
        'photo-drop-zone--dragging': dragging,
        'photo-drop-zone--disabled': disabled,
      })}
      {...dropProps}
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
