/* eslint-disable @typescript-eslint/no-unnecessary-condition --
 * `cancelled` mutates in the useEffect cleanup after the async fetch
 * reads it. TS control-flow doesn't track the mutation across the
 * closure so the checks look "always truthy/falsy", but the guards
 * are load-bearing: without them setState fires after unmount. */

import { useEffect, useState, useCallback } from 'react';
import type { FormEvent } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiRequestGet, apiRequestPut } from 'mastodon/api';
import {
  SettingsSection,
  SettingsStatus,
} from 'mastodon/features/settings/components';
import type { SaveStatus } from 'mastodon/features/settings/components';

// Native sign-in credentials form (email + password) inside
// /settings/account. Replaces the "Change email or password"
// link-out to Devise's /auth/edit (Tal 2026-09-13). Wraps
// PUT /api/v1/settings/credentials.
//
// Behaviour:
//   * The current email is shown read-only above the "New email" field
//     so the user knows what they're editing away from.
//   * A pending Devise-confirmable email change shows an inline
//     banner ("Pending: new@example.com — check your inbox"); until
//     the user clicks the confirmation link, `email` stays as the
//     old address.
//   * All changes require the current password.
//   * Only non-empty fields are sent to the API — leaving
//     "New email" blank + typing a new password just changes the
//     password.
//   * Password change wipes other sessions server-side (see the
//     credentials controller); the current SPA session survives if
//     cookie-authed.

const messages = defineMessages({
  emailSectionTitle: {
    id: 'credentials_form.email_section',
    defaultMessage: 'Email',
  },
  passwordSectionTitle: {
    id: 'credentials_form.password_section',
    defaultMessage: 'Password',
  },
  currentEmail: {
    id: 'credentials_form.current_email',
    defaultMessage: 'Current email',
  },
  newEmail: {
    id: 'credentials_form.new_email',
    defaultMessage: 'New email',
  },
  newEmailPlaceholder: {
    id: 'credentials_form.new_email_placeholder',
    defaultMessage: 'Leave blank to keep the current one',
  },
  pendingEmail: {
    id: 'credentials_form.pending_email',
    defaultMessage:
      'Pending confirmation: {email} — check your inbox and click the link.',
  },
  newPassword: {
    id: 'credentials_form.new_password',
    defaultMessage: 'New password',
  },
  confirmPassword: {
    id: 'credentials_form.confirm_password',
    defaultMessage: 'Confirm new password',
  },
  passwordHint: {
    id: 'credentials_form.password_hint',
    defaultMessage:
      'At least 8 characters. Leave blank to keep the current one.',
  },
  currentPassword: {
    id: 'credentials_form.current_password',
    defaultMessage: 'Current password',
  },
  currentPasswordHint: {
    id: 'credentials_form.current_password_hint',
    defaultMessage: 'Required to confirm any change.',
  },
  save: { id: 'credentials_form.save', defaultMessage: 'Save changes' },
  savingSession: {
    id: 'credentials_form.password_change_note',
    defaultMessage:
      'Changing your password will sign you out on every other device.',
  },

  errIncorrectPassword: {
    id: 'credentials_form.err_incorrect_password',
    defaultMessage: 'That current password is incorrect.',
  },
  errPasswordMismatch: {
    id: 'credentials_form.err_password_mismatch',
    defaultMessage: 'The two new passwords don’t match.',
  },
  errNoChanges: {
    id: 'credentials_form.err_no_changes',
    defaultMessage: 'Nothing to change — enter a new email or password first.',
  },
  errGeneric: {
    id: 'credentials_form.err_generic',
    defaultMessage: 'Couldn’t save. Please try again.',
  },

  saved: {
    id: 'credentials_form.saved',
    defaultMessage: 'Saved.',
  },
  savedEmailPending: {
    id: 'credentials_form.saved_email_pending',
    defaultMessage:
      'Password saved. Confirm your new email via the link we just sent.',
  },
});

interface CredentialsPayload {
  email: string;
  unconfirmed_email: string | null;
}

interface ApiError {
  error?: string;
}

export const CredentialsForm: React.FC = () => {
  const intl = useIntl();
  const [email, setEmail] = useState('');
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');

  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiRequestGet<CredentialsPayload>(
          'v1/settings/credentials',
        );
        if (cancelled) return;
        setEmail(res.email);
        setUnconfirmedEmail(res.unconfirmed_email);
        setLoaded(true);
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const doSubmit = useCallback(async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedNewEmail = newEmail.trim();
    const wantsEmailChange =
      trimmedNewEmail !== '' && trimmedNewEmail !== email;
    const wantsPasswordChange = newPassword !== '';

    if (!wantsEmailChange && !wantsPasswordChange) {
      setErrorMsg(intl.formatMessage(messages.errNoChanges));
      setStatus('error');
      return;
    }
    if (wantsPasswordChange && newPassword !== confirmPassword) {
      setErrorMsg(intl.formatMessage(messages.errPasswordMismatch));
      setStatus('error');
      return;
    }
    if (currentPassword === '') {
      setErrorMsg(intl.formatMessage(messages.errIncorrectPassword));
      setStatus('error');
      return;
    }

    const body: Record<string, string> = { current_password: currentPassword };
    if (wantsEmailChange) body.email = trimmedNewEmail;
    if (wantsPasswordChange) {
      body.password = newPassword;
      body.password_confirmation = confirmPassword;
    }

    setStatus('saving');
    try {
      const res = await apiRequestPut<CredentialsPayload>(
        'v1/settings/credentials',
        body,
      );
      setEmail(res.email);
      setUnconfirmedEmail(res.unconfirmed_email);
      setNewEmail('');
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPassword('');
      setStatus('saved');
      setSuccessMsg(
        wantsEmailChange
          ? intl.formatMessage(messages.savedEmailPending)
          : intl.formatMessage(messages.saved),
      );
    } catch (err) {
      setStatus('error');
      const apiErr =
        (err as { response?: { data?: ApiError } })?.response?.data ?? null;
      if (apiErr?.error === 'incorrect_current_password') {
        setErrorMsg(intl.formatMessage(messages.errIncorrectPassword));
      } else if (apiErr?.error === 'no_changes') {
        setErrorMsg(intl.formatMessage(messages.errNoChanges));
      } else {
        setErrorMsg(intl.formatMessage(messages.errGeneric));
      }
    }
  }, [intl, email, newEmail, newPassword, confirmPassword, currentPassword]);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      void doSubmit();
    },
    [doSubmit],
  );

  const onNewEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setNewEmail(e.target.value);
    },
    [],
  );
  const onNewPasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setNewPassword(e.target.value);
    },
    [],
  );
  const onConfirmPasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setConfirmPassword(e.target.value);
    },
    [],
  );
  const onCurrentPasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setCurrentPassword(e.target.value);
    },
    [],
  );

  if (!loaded) return null;

  return (
    <form
      className='credentials-form'
      onSubmit={handleSubmit}
      autoComplete='off'
    >
      <SettingsSection title={intl.formatMessage(messages.emailSectionTitle)}>
        <div className='settings-page__row settings-page__row--stack'>
          <div className='settings-page__row-body'>
            <div className='settings-page__row-label'>
              {intl.formatMessage(messages.currentEmail)}
            </div>
            <div className='settings-page__row-desc credentials-form__readonly'>
              {email}
            </div>
          </div>
        </div>

        {unconfirmedEmail && (
          <div className='credentials-form__pending'>
            {intl.formatMessage(messages.pendingEmail, {
              email: unconfirmedEmail,
            })}
          </div>
        )}

        <div className='settings-page__row settings-page__row--stack'>
          <div className='settings-page__row-body'>
            <label
              className='settings-page__row-label'
              htmlFor='credentials-new-email'
            >
              {intl.formatMessage(messages.newEmail)}
            </label>
          </div>
          <input
            id='credentials-new-email'
            type='email'
            className='credentials-form__input'
            value={newEmail}
            placeholder={intl.formatMessage(messages.newEmailPlaceholder)}
            onChange={onNewEmailChange}
            autoComplete='email'
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title={intl.formatMessage(messages.passwordSectionTitle)}
        description={intl.formatMessage(messages.savingSession)}
      >
        <div className='settings-page__row settings-page__row--stack'>
          <div className='settings-page__row-body'>
            <label
              className='settings-page__row-label'
              htmlFor='credentials-new-password'
            >
              {intl.formatMessage(messages.newPassword)}
            </label>
            <div className='settings-page__row-desc'>
              {intl.formatMessage(messages.passwordHint)}
            </div>
          </div>
          <input
            id='credentials-new-password'
            type='password'
            className='credentials-form__input'
            value={newPassword}
            onChange={onNewPasswordChange}
            autoComplete='new-password'
          />
        </div>

        <div className='settings-page__row settings-page__row--stack'>
          <div className='settings-page__row-body'>
            <label
              className='settings-page__row-label'
              htmlFor='credentials-confirm-password'
            >
              {intl.formatMessage(messages.confirmPassword)}
            </label>
          </div>
          <input
            id='credentials-confirm-password'
            type='password'
            className='credentials-form__input'
            value={confirmPassword}
            onChange={onConfirmPasswordChange}
            autoComplete='new-password'
          />
        </div>
      </SettingsSection>

      <SettingsSection title={intl.formatMessage(messages.currentPassword)}>
        <div className='settings-page__row settings-page__row--stack'>
          <div className='settings-page__row-body'>
            <label
              className='settings-page__row-label'
              htmlFor='credentials-current-password'
            >
              {intl.formatMessage(messages.currentPassword)}
            </label>
            <div className='settings-page__row-desc'>
              {intl.formatMessage(messages.currentPasswordHint)}
            </div>
          </div>
          <input
            id='credentials-current-password'
            type='password'
            className='credentials-form__input'
            value={currentPassword}
            onChange={onCurrentPasswordChange}
            autoComplete='current-password'
          />
        </div>

        <div className='credentials-form__actions'>
          <div className='credentials-form__status'>
            <SettingsStatus status={status} />
            {status === 'error' && errorMsg && (
              <span className='credentials-form__error'>{errorMsg}</span>
            )}
            {status === 'saved' && successMsg && (
              <span className='credentials-form__success'>{successMsg}</span>
            )}
          </div>
          <button
            type='submit'
            className='credentials-form__submit'
            disabled={status === 'saving'}
          >
            {intl.formatMessage(messages.save)}
          </button>
        </div>
      </SettingsSection>
    </form>
  );
};
