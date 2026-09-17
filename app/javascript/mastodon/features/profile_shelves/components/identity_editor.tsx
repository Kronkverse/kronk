import { useState, useMemo, useCallback } from 'react';

import { useIntl, defineMessages } from 'react-intl';

import { importFetchedAccount } from 'mastodon/actions/importer';
import api from 'mastodon/api';
import { AvatarHeaderInput } from 'mastodon/components/avatar_header_input';
import { me } from 'mastodon/initial_state';
import { useAppSelector, useAppDispatch } from 'mastodon/store';
import { unescapeHTML } from 'mastodon/utils/html';

import { ProfileFieldsEditor } from './profile_fields_editor';

// Identity editor — your public identity: display name, bio, avatar, cover
// image. Profile fields are the structured-field surface below
// (ProfileFieldsEditor). Rendered inside the profile's Arrange mode (the
// owner's edit surface). Auto-saves: text fields commit on blur, avatar /
// cover commit the moment they're picked — there is no Save button (matches
// the auto-saving section switches beside it).
//
// Saves go through a direct partial `update_credentials` and push the result
// into the store so every surface refreshes. NOT the updateAccount action:
// that force-writes discoverable/indexable (privacy) on every call, which this
// editor must not touch.

const messages = defineMessages({
  uploadHeader: {
    id: 'profile.identity.upload_cover',
    defaultMessage: 'Upload cover image',
  },
  uploadAvatar: {
    id: 'profile.identity.upload_avatar',
    defaultMessage: 'Upload avatar',
  },
  displayName: {
    id: 'profile.identity.display_name',
    defaultMessage: 'Display name',
  },
  note: { id: 'profile.identity.bio', defaultMessage: 'Bio' },
  saving: { id: 'profile.identity.saving', defaultMessage: 'Saving…' },
  saved: { id: 'profile.identity.saved', defaultMessage: 'Saved' },
  error: {
    id: 'profile.identity.error',
    defaultMessage: "Couldn't save — try again.",
  },
});

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export const ProfileIdentityEditor: React.FC = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const account = useAppSelector((state) =>
    me ? state.accounts.get(me) : undefined,
  );

  const [displayName, setDisplayName] = useState(account?.display_name ?? '');
  const [note, setNote] = useState(account ? unescapeHTML(account.note) : '');
  const [avatar, setAvatar] = useState<File>();
  const [header, setHeader] = useState<File>();
  const [status, setStatus] = useState<SaveStatus>('idle');

  // One partial update_credentials call, store-refresh + status on completion.
  const patchCredentials = useCallback(
    (data: FormData) => {
      setStatus('saving');
      void api()
        .patch('/api/v1/accounts/update_credentials', data)
        .then((response) => {
          dispatch(importFetchedAccount(response.data));
          setStatus('saved');
          return undefined;
        })
        .catch(() => {
          setStatus('error');
        });
    },
    [dispatch],
  );

  // Name + bio commit together on blur. (Structured profile fields save
  // themselves in ProfileFieldsEditor; the legacy fields_attributes metadata
  // is left untouched — it stays server-side for federation.)
  const saveText = useCallback(() => {
    const data = new FormData();
    data.append('display_name', displayName);
    data.append('note', note);
    patchCredentials(data);
  }, [patchCredentials, displayName, note]);

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

  // Avatar / cover commit immediately on pick — no blur to wait for, and
  // saving from the event file avoids racing the setState.
  const handleAvatarChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      setAvatar(file);
      if (file) {
        const data = new FormData();
        data.append('avatar', file);
        patchCredentials(data);
      }
    },
    [patchCredentials],
  );
  const handleHeaderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      setHeader(file);
      if (file) {
        const data = new FormData();
        data.append('header', file);
        patchCredentials(data);
      }
    },
    [patchCredentials],
  );

  const avatarPreview = useMemo(
    () => (avatar ? URL.createObjectURL(avatar) : (account?.avatar ?? null)),
    [avatar, account],
  );
  const headerPreview = useMemo(
    () => (header ? URL.createObjectURL(header) : (account?.header ?? null)),
    [header, account],
  );

  return (
    <div className='profile-identity-editor'>
      <AvatarHeaderInput
        avatarPreview={avatarPreview}
        headerPreview={headerPreview}
        onAvatarChange={handleAvatarChange}
        onHeaderChange={handleHeaderChange}
        avatarTitle={intl.formatMessage(messages.uploadAvatar)}
        headerTitle={intl.formatMessage(messages.uploadHeader)}
      />

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
              onBlur={saveText}
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
              onBlur={saveText}
              maxLength={500}
              rows={4}
            />
          </div>
        </div>
      </div>

      <ProfileFieldsEditor />

      {status !== 'idle' && (
        <p
          className={
            status === 'error'
              ? 'profile-identity-editor__status profile-identity-editor__status--error'
              : 'profile-identity-editor__status'
          }
          role='status'
        >
          {intl.formatMessage(
            status === 'saving'
              ? messages.saving
              : status === 'error'
                ? messages.error
                : messages.saved,
          )}
        </p>
      )}
    </div>
  );
};
