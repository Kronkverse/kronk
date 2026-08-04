import type { ChangeEvent } from 'react';
import { useCallback, useRef } from 'react';

import { defineMessages, useIntl } from 'react-intl';

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
  // Fired when the user has picked a file via either the camera or
  // library input. Consumer owns any subsequent upload / preview.
  onPick: (file: File) => void;
  // Restricts the accept attribute. Defaults to 'image/*,video/*'.
  accept?: string;
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
  disabled,
  className,
}) => {
  const intl = useIntl();
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const onFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      onPick(file);
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
      >
        {intl.formatMessage(messages.capture)}
      </button>
      <button
        type='button'
        className='media-pick-buttons__btn'
        onClick={openLibrary}
        disabled={disabled}
      >
        {intl.formatMessage(messages.library)}
      </button>
    </div>
  );
};
