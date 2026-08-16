import { useState, useMemo, useCallback } from 'react';

import { useIntl, defineMessages } from 'react-intl';

import { importFetchedAccount } from 'mastodon/actions/importer';
import api from 'mastodon/api';
import { AvatarHeaderInput } from 'mastodon/components/avatar_header_input';
import { me } from 'mastodon/initial_state';
import { useAppSelector, useAppDispatch } from 'mastodon/store';
import { unescapeHTML } from 'mastodon/utils/html';

// Identity editor — your public identity: display name, bio, avatar, cover
// image, and the up-to-four profile fields. Rendered inside the profile's
// Arrange mode (the owner's edit surface). Auto-saves: text fields commit on
// blur, avatar / cover commit the moment they're picked — there is no Save
// button (matches the auto-saving section switches beside it).
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
  fields: {
    id: 'profile.identity.fields',
    defaultMessage: 'Profile fields',
  },
  fieldsHint: {
    id: 'profile.identity.fields_hint',
    defaultMessage: 'Up to four — pronouns, a link, where you are.',
  },
  fieldName: { id: 'profile.identity.field_name', defaultMessage: 'Label' },
  fieldValue: {
    id: 'profile.identity.field_value',
    defaultMessage: 'Content',
  },
  saving: { id: 'profile.identity.saving', defaultMessage: 'Saving…' },
  saved: { id: 'profile.identity.saved', defaultMessage: 'Saved' },
  error: {
    id: 'profile.identity.error',
    defaultMessage: "Couldn't save — try again.",
  },
});

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface FieldRow {
  name: string;
  value: string;
}

// Mastodon's standard profile-field cap.
const MAX_FIELDS = 4;

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

  // Prefill from the raw editable values (value_plain drops the HTML the API
  // wraps URLs in), padded to MAX_FIELDS empty rows.
  const [fields, setFields] = useState<FieldRow[]>(() => {
    const existing = (account?.fields.toArray() ?? []).map((field) => ({
      name: field.name,
      value: field.value_plain ?? field.value,
    }));
    while (existing.length < MAX_FIELDS) existing.push({ name: '', value: '' });
    return existing.slice(0, MAX_FIELDS);
  });

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

  // Text fields (name, bio, metadata) commit together on blur.
  const saveText = useCallback(() => {
    const data = new FormData();
    data.append('display_name', displayName);
    data.append('note', note);
    // Send all MAX_FIELDS slots (indexed hash form the API expects); empty
    // rows clear a removed field.
    fields.forEach((row, i) => {
      data.append(`fields_attributes[${i}][name]`, row.name);
      data.append(`fields_attributes[${i}][value]`, row.value);
    });
    patchCredentials(data);
  }, [patchCredentials, displayName, note, fields]);

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

  // data-index / data-key on each input so a single handler covers all rows
  // without an inline arrow per input.
  const handleFieldChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const idx = Number(e.currentTarget.dataset.index);
      const key = e.currentTarget.dataset.key === 'name' ? 'name' : 'value';
      const { value } = e.currentTarget;
      setFields((prev) =>
        prev.map((row, i) => (i === idx ? { ...row, [key]: value } : row)),
      );
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

      <div className='profile-identity-editor__fields'>
        <p className='profile-identity-editor__fields-label'>
          {intl.formatMessage(messages.fields)}
        </p>
        <p className='profile-identity-editor__fields-hint'>
          {intl.formatMessage(messages.fieldsHint)}
        </p>
        {fields.map((row, i) => (
          <div
            className='profile-identity-editor__field-row'
            key={`field-${i}`}
          >
            <input
              type='text'
              aria-label={intl.formatMessage(messages.fieldName)}
              placeholder={intl.formatMessage(messages.fieldName)}
              value={row.name}
              data-index={i}
              data-key='name'
              onChange={handleFieldChange}
              onBlur={saveText}
              maxLength={255}
            />
            <input
              type='text'
              aria-label={intl.formatMessage(messages.fieldValue)}
              placeholder={intl.formatMessage(messages.fieldValue)}
              value={row.value}
              data-index={i}
              data-key='value'
              onChange={handleFieldChange}
              onBlur={saveText}
              maxLength={255}
            />
          </div>
        ))}
      </div>

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
