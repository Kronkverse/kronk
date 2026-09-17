import { useMemo } from 'react';

import classNames from 'classnames';

import AddPhotoAlternateIcon from '@/material-icons/400-24px/add_photo_alternate.svg?react';
import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import { Icon } from 'mastodon/components/icon';

// The avatar + cover-image upload pair — two file-input labels with a live
// preview and an add/edit icon. Shared by the onboarding profile step and the
// profile Arrange-mode identity editor, which had byte-identical copies of
// this markup. Presentational only: the caller owns the preview URLs, the
// change handlers, and whatever save flow sits around it.

interface Props {
  avatarPreview: string | null;
  headerPreview: string | null;
  onAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onHeaderChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
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
      <label
        className={classNames('app-form__header-input', {
          selected: !!headerPreview,
          invalid: headerInvalid,
        })}
        title={headerTitle}
      >
        <input type='file' hidden accept='image/*' onChange={onHeaderChange} />
        {headerPreview && <img src={headerPreview} alt='' />}
        <Icon id='' icon={headerIcon} />
      </label>

      <label
        className={classNames('app-form__avatar-input', {
          selected: !!avatarPreview,
          invalid: avatarInvalid,
        })}
        title={avatarTitle}
      >
        <input type='file' hidden accept='image/*' onChange={onAvatarChange} />
        {avatarPreview && <img src={avatarPreview} alt='' />}
        <Icon id='' icon={avatarIcon} />
      </label>
    </div>
  );
};
