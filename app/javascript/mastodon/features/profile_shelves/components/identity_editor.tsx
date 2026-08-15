import { useState, useMemo, useCallback } from 'react';

import { useIntl, defineMessages, FormattedMessage } from 'react-intl';

import { importFetchedAccount } from 'mastodon/actions/importer';
import api from 'mastodon/api';
import { AvatarHeaderInput } from 'mastodon/components/avatar_header_input';
import { Button } from 'mastodon/components/button';
import { me } from 'mastodon/initial_state';
import { useAppSelector, useAppDispatch } from 'mastodon/store';
import { unescapeHTML } from 'mastodon/utils/html';

// Identity editor — your public identity: display name, bio, avatar, cover
// image, and the up-to-four profile fields. Rendered inside the profile's
// Arrange mode (the owner's edit surface — Arrange is the entry, no separate
// button/route). Saves via a direct partial `update_credentials` and pushes
// the result into the store so every surface refreshes.
//
// Reuses the shipped onboarding-profile upload UI (label + `hidden` file
// input, which the file-input aesthetic guard accepts) + its form classes.
// This is the single home for identity editing; the old /@:acct/edit composer
// that once carried a stub of this is being retired (see docs/rebuild).

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
  save: { id: 'profile.identity.save', defaultMessage: 'Save' },
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

  const handleSubmit = useCallback(() => {
    setStatus('saving');

    // Direct partial update_credentials — only the identity fields. NOT the
    // updateAccount action: it force-writes discoverable/indexable (privacy
    // settings) on every call, which this editor must not touch.
    const data = new FormData();
    data.append('display_name', displayName);
    data.append('note', note);
    if (avatar) data.append('avatar', avatar);
    if (header) data.append('header', header);
    // Send all MAX_FIELDS slots (indexed hash form the API expects); empty
    // rows clear a removed field.
    fields.forEach((row, i) => {
      data.append(`fields_attributes[${i}][name]`, row.name);
      data.append(`fields_attributes[${i}][value]`, row.value);
    });

    void api()
      .patch('/api/v1/accounts/update_credentials', data)
      .then((response) => {
        // Refresh the store so nav avatar, profile header and cards update
        // without a reload.
        dispatch(importFetchedAccount(response.data));
        setStatus('saved');
        return undefined;
      })
      .catch(() => {
        setStatus('error');
      });
  }, [dispatch, displayName, note, avatar, header, fields]);

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
              maxLength={255}
            />
          </div>
        ))}
      </div>

      <div className='profile-identity-editor__actions'>
        <Button onClick={handleSubmit} disabled={status === 'saving'}>
          {intl.formatMessage(
            status === 'saving' ? messages.saving : messages.save,
          )}
        </Button>
        {status === 'saved' && (
          <span className='profile-identity-editor__status'>
            {intl.formatMessage(messages.saved)}
          </span>
        )}
        {status === 'error' && (
          <span className='profile-identity-editor__status profile-identity-editor__status--error'>
            <FormattedMessage {...messages.error} />
          </span>
        )}
      </div>
    </div>
  );
};
