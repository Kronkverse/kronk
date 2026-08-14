import { useState, useMemo, useCallback, createRef } from 'react';

import { useIntl, defineMessages, FormattedMessage } from 'react-intl';

import classNames from 'classnames';

import AddPhotoAlternateIcon from '@/material-icons/400-24px/add_photo_alternate.svg?react';
import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import api from 'mastodon/api';
import { Button } from 'mastodon/components/button';
import { Icon } from 'mastodon/components/icon';
import { me } from 'mastodon/initial_state';
import { useAppSelector } from 'mastodon/store';
import { unescapeHTML } from 'mastodon/utils/html';

// The "Header" tab of the profile composer — your public identity: display
// name, bio, avatar, and cover image. Was a stub ("editing lands in the next
// step") while the registry advertised /@user/edit as live; this wires it to
// the existing `update_credentials` API via the `updateAccount` action, reusing
// the shipped onboarding-profile upload UI (label + `hidden` file input, which
// the file-input aesthetic guard accepts) and its form classes. Metadata
// fields (the name/value profile rows) are a follow-up.

const messages = defineMessages({
  uploadHeader: {
    id: 'profile_compose.header.upload_cover',
    defaultMessage: 'Upload cover image',
  },
  uploadAvatar: {
    id: 'profile_compose.header.upload_avatar',
    defaultMessage: 'Upload avatar',
  },
  displayName: {
    id: 'profile_compose.header.display_name',
    defaultMessage: 'Display name',
  },
  note: { id: 'profile_compose.header.bio', defaultMessage: 'Bio' },
  save: { id: 'profile_compose.header.save', defaultMessage: 'Save' },
  saving: { id: 'profile_compose.header.saving', defaultMessage: 'Saving…' },
  saved: { id: 'profile_compose.header.saved', defaultMessage: 'Saved' },
  error: {
    id: 'profile_compose.header.error',
    defaultMessage: "Couldn't save — try again.",
  },
});

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export const ProfileHeaderEditor: React.FC = () => {
  const intl = useIntl();
  const account = useAppSelector((state) =>
    me ? state.accounts.get(me) : undefined,
  );

  const [displayName, setDisplayName] = useState(account?.display_name ?? '');
  const [note, setNote] = useState(account ? unescapeHTML(account.note) : '');
  const [avatar, setAvatar] = useState<File>();
  const [header, setHeader] = useState<File>();
  const [status, setStatus] = useState<SaveStatus>('idle');

  const avatarFileRef = createRef<HTMLInputElement>();
  const headerFileRef = createRef<HTMLInputElement>();

  const handleDisplayNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setDisplayName(e.target.value);
    },
    [],
  );
  const handleNoteChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setNote(e.target.value);
    },
    [],
  );
  const handleAvatarChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setAvatar(e.target.files?.[0]);
    },
    [],
  );
  const handleHeaderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setHeader(e.target.files?.[0]);
    },
    [],
  );

  const avatarPreview = useMemo(
    () => (avatar ? URL.createObjectURL(avatar) : (account?.avatar ?? null)),
    [avatar, account],
  );
  const headerPreview = useMemo(
    () => (header ? URL.createObjectURL(header) : (account?.header ?? null)),
    [header, account],
  );

  const handleSubmit = useCallback(() => {
    setStatus('saving');

    // Direct partial update_credentials — only the fields this tab owns.
    // NOT the updateAccount action: it force-writes discoverable/indexable
    // (privacy settings) on every call, which this editor must not touch.
    const data = new FormData();
    data.append('display_name', displayName);
    data.append('note', note);
    if (avatar) data.append('avatar', avatar);
    if (header) data.append('header', header);

    void api()
      .patch('/api/v1/accounts/update_credentials', data)
      .then(() => {
        setStatus('saved');
        return undefined;
      })
      .catch(() => {
        setStatus('error');
      });
  }, [displayName, note, avatar, header]);

  return (
    <div className='profile-header-editor'>
      <div className='onboarding__profile'>
        <label
          className={classNames('app-form__header-input', {
            selected: !!headerPreview,
          })}
          title={intl.formatMessage(messages.uploadHeader)}
        >
          <input
            type='file'
            hidden
            ref={headerFileRef}
            accept='image/*'
            onChange={handleHeaderChange}
          />
          {headerPreview && <img src={headerPreview} alt='' />}
          <Icon id='' icon={headerPreview ? EditIcon : AddPhotoAlternateIcon} />
        </label>

        <label
          className={classNames('app-form__avatar-input', {
            selected: !!avatarPreview,
          })}
          title={intl.formatMessage(messages.uploadAvatar)}
        >
          <input
            type='file'
            hidden
            ref={avatarFileRef}
            accept='image/*'
            onChange={handleAvatarChange}
          />
          {avatarPreview && <img src={avatarPreview} alt='' />}
          <Icon id='' icon={avatarPreview ? EditIcon : AddPhotoAlternateIcon} />
        </label>
      </div>

      <div className='fields-group'>
        <div className='input with_block_label'>
          <label htmlFor='profile-display-name'>
            {intl.formatMessage(messages.displayName)}
          </label>
          <div className='label_input'>
            <input
              id='profile-display-name'
              type='text'
              value={displayName}
              onChange={handleDisplayNameChange}
              maxLength={30}
            />
          </div>
        </div>

        <div className='input with_block_label'>
          <label htmlFor='profile-bio'>
            {intl.formatMessage(messages.note)}
          </label>
          <div className='label_input'>
            <textarea
              id='profile-bio'
              value={note}
              onChange={handleNoteChange}
              maxLength={500}
              rows={4}
            />
          </div>
        </div>
      </div>

      <div className='profile-header-editor__actions'>
        <Button onClick={handleSubmit} disabled={status === 'saving'}>
          {intl.formatMessage(
            status === 'saving' ? messages.saving : messages.save,
          )}
        </Button>
        {status === 'saved' && (
          <span className='profile-header-editor__status'>
            {intl.formatMessage(messages.saved)}
          </span>
        )}
        {status === 'error' && (
          <span className='profile-header-editor__status profile-header-editor__status--error'>
            <FormattedMessage {...messages.error} />
          </span>
        )}
      </div>
    </div>
  );
};
