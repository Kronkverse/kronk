import { useCallback, useMemo } from 'react';

import classNames from 'classnames';

import AddPhotoAlternateIcon from '@/material-icons/400-24px/add_photo_alternate.svg?react';
import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import { Icon } from 'mastodon/components/icon';
import { usePhotoDrop } from 'mastodon/hooks/usePhotoDrop';

// The avatar + cover-image upload pair — two file-input labels with a live
// preview and an add/edit icon. Shared by the onboarding profile step and the
// profile Arrange-mode identity editor, which had byte-identical copies of
// this markup. Presentational only: the caller owns the preview URLs, the
// change handlers, and whatever save flow sits around it.

interface Props {
  avatarPreview: string | null;
  headerPreview: string | null;
  // A picked or dropped photo.
  onAvatarChange: (file: File) => void;
  onHeaderChange: (file: File) => void;
  avatarTitle: string;
  headerTitle: string;
  avatarInvalid?: boolean;
  headerInvalid?: boolean;
}

export const AvatarHeaderInput: React.FC<Props> = ({
  avatarPreview,
  headerPreview,
  onAvatarChange,
  onHeaderChange,
  avatarTitle,
  headerTitle,
  avatarInvalid = false,
  headerInvalid = false,
}) => {
  const headerIcon = useMemo(
    () => (headerPreview ? EditIcon : AddPhotoAlternateIcon),
    [headerPreview],
  );
  const avatarIcon = useMemo(
    () => (avatarPreview ? EditIcon : AddPhotoAlternateIcon),
    [avatarPreview],
  );

  return (
    <div className='onboarding__profile'>
      <PhotoLabel
        className={classNames('app-form__header-input', {
          selected: !!headerPreview,
          invalid: headerInvalid,
        })}
        title={headerTitle}
        preview={headerPreview}
        icon={headerIcon}
        onPick={onHeaderChange}
      />
      <PhotoLabel
        className={classNames('app-form__avatar-input', {
          selected: !!avatarPreview,
          invalid: avatarInvalid,
        })}
        title={avatarTitle}
        preview={avatarPreview}
        icon={avatarIcon}
        onPick={onAvatarChange}
      />
    </div>
  );
};

// One of the pair: click to choose a photo, or drop one on it.
const PhotoLabel: React.FC<{
  className: string;
  title: string;
  preview: string | null;
  icon: typeof EditIcon;
  onPick: (file: File) => void;
}> = ({ className, title, preview, icon, onPick }) => {
  const handleFiles = useCallback(
    (files: File[]) => {
      if (files[0]) onPick(files[0]);
    },
    [onPick],
  );
  const { dragging, dropProps, take } = usePhotoDrop({
    onFiles: handleFiles,
    multiple: false,
  });
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      take(e.target.files);
      e.target.value = '';
    },
    [take],
  );

  return (
    <label
      className={classNames(className, { 'photo-drop-over': dragging })}
      title={title}
      {...dropProps}
    >
      <input type='file' hidden accept='image/*' onChange={handleChange} />
      {preview && <img src={preview} alt='' />}
      <Icon id='' icon={icon} />
    </label>
  );
};
