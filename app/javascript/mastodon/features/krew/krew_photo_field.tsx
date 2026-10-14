import { useCallback } from 'react';

import { Icon } from 'mastodon/components/icon';
import type { IconProp } from 'mastodon/components/icon';

// A Krew's photo as something you can change: the square it is shown in,
// with a camera on its corner, and the whole square opens the file
// chooser. Shared by the Krew page, Gather a Krew and Krew settings.

export const krewInitial = (name: string): string => {
  const first = name.trim().charAt(0);
  return first.length === 0 ? 'K' : first.toUpperCase();
};

export const KrewPhotoField: React.FC<{
  name: string;
  imageUrl: string | null;
  label: string;
  icon: IconProp;
  disabled?: boolean;
  onPick: (file: File | null) => void;
}> = ({ name, imageUrl, label, icon, disabled = false, onPick }) => {
  const handleChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      onPick(e.currentTarget.files?.[0] ?? null);
      // So choosing the same file again still counts as a change.
      e.currentTarget.value = '';
    },
    [onPick],
  );

  return (
    <label
      className='krew-detail__avatar krew-detail__avatar--editable'
      title={label}
    >
      {imageUrl ? (
        <img src={imageUrl} alt='' className='krew-detail__avatar-img' />
      ) : (
        krewInitial(name)
      )}
      <span className='krew-detail__avatar-badge' aria-hidden='true'>
        <Icon id='photo-camera' icon={icon} />
      </span>
      <input
        type='file'
        accept='image/*'
        onChange={handleChange}
        disabled={disabled}
        aria-label={label}
        className='krew-detail__avatar-input'
      />
    </label>
  );
};
