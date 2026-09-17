import type { ChangeEvent } from 'react';
import { useCallback, useRef } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import AddPhotoAlternateIcon from '@/material-icons/400-24px/add_photo_alternate.svg?react';
import PhotoCameraIcon from '@/material-icons/400-24px/photo_camera.svg?react';
import { Icon } from 'mastodon/components/icon';

const messages = defineMessages({
  capture: {
    id: 'media_pick.capture',
    defaultMessage: 'Take a photo or video',
  },
  library: {
    id: 'media_pick.library',
    defaultMessage: 'Choose from library',
  },
});

interface MediaPickButtonsProps {
  // Fired when the user has picked one or more files via either the
  // camera or library input. Always an array — single-file callers
  // read `[0]`. Consumer owns any subsequent upload / preview.
  onPick: (files: File[]) => void;
  // Restricts the accept attribute. Defaults to 'image/*,video/*'.
  accept?: string;
  // Allow picking multiple files at once on the library input. The
  // camera input never gets `multiple` (mobile shutter is one-shot).
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
}

// Two-button pair for picking a media file: one triggers the OS
// camera on mobile (`<input capture="environment">`), the other opens
// the standard file picker. On desktop the `capture` attribute is
// ignored and both buttons behave the same — mild UX duplication but
// avoids any user-agent sniffing. Extracted from the Moments
// composer so Booth, Albutts, Nudges etc. can adopt without
// re-implementing.
export const MediaPickButtons: React.FC<MediaPickButtonsProps> = ({
  onPick,
  accept = 'image/*,video/*',
  multiple = false,
  disabled,
  className,
}) => {
  const intl = useIntl();
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const onFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      if (files.length === 0) return;
      onPick(files);
      // Reset the input so picking the same filename again re-fires.
      event.target.value = '';
    },
    [onPick],
  );

  const openLibrary = useCallback(() => {
    libraryInputRef.current?.click();
  }, []);
  const openCamera = useCallback(() => {
    cameraInputRef.current?.click();
  }, []);

  const rootClass = ['media-pick-buttons', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass}>
      <input
        ref={libraryInputRef}
        className='media-pick-buttons__input'
        type='file'
        accept={accept}
        multiple={multiple}
        onChange={onFileChange}
        disabled={disabled}
      />
      <input
        ref={cameraInputRef}
        className='media-pick-buttons__input'
        type='file'
        accept={accept}
        capture='environment'
        onChange={onFileChange}
        disabled={disabled}
      />
      <button
        type='button'
        className='media-pick-buttons__btn'
        onClick={openCamera}
        disabled={disabled}
        title={intl.formatMessage(messages.capture)}
        aria-label={intl.formatMessage(messages.capture)}
      >
        <Icon id='photo_camera' icon={PhotoCameraIcon} />
      </button>
      <button
        type='button'
        className='media-pick-buttons__btn'
        onClick={openLibrary}
        disabled={disabled}
        title={intl.formatMessage(messages.library)}
        aria-label={intl.formatMessage(messages.library)}
      >
        <Icon id='add_photo_alternate' icon={AddPhotoAlternateIcon} />
      </button>
    </div>
  );
};
