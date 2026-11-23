import { useCallback, useEffect, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { isAxiosError } from 'axios';

import {
  KOLLECTION_SCOPES,
  apiCreateKollectionApp,
  apiGetKollectionApp,
  apiUpdateKollectionApp,
} from 'mastodon/api/kollection';
import type {
  ApiKollectionAppJSON,
  KollectionScope,
} from 'mastodon/api/kollection';
import { apiUploadListingMedia } from 'mastodon/api/wachuneed';
import {
  ComposeBody,
  ComposeCheck,
  ComposeField,
  ComposeHint,
  ComposeInput,
  ComposeSection,
  ComposeTextarea,
  ComposeTitle,
} from 'mastodon/components/compose_fields';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LoadingState } from 'mastodon/components/loading_state';
import { PhotoDropZone } from 'mastodon/components/media';

import { knownScopes, scopeMessages } from './scopes';

// Add an app to Kollection, or change one you keep
// (docs/spaces/kollection.md). The standard composer overlay with the kit:
// an icon, the name, what it is, its website, and whether it signs people
// in with Kronk. One that does takes where Kronk sends people back (one
// address per line, an app may have several) and what it may see. No
// reach control: every app is for every member. No Konnect row: an app is
// not something to Konnect.

const messages = defineMessages({
  titleNew: {
    id: 'kollection.compose.title_new',
    defaultMessage: 'Add an app',
  },
  titleEdit: {
    id: 'kollection.compose.title_edit',
    defaultMessage: 'Edit app',
  },
  subtitle: {
    id: 'kollection.compose.subtitle',
    defaultMessage:
      'It is listed for every member straight away. You keep it: only you and the admins see its keys.',
  },
  add: { id: 'kollection.compose.add', defaultMessage: 'Add' },
  save: { id: 'kollection.compose.save', defaultMessage: 'Save' },
  saving: { id: 'kollection.compose.saving', defaultMessage: 'Saving…' },
  loading: { id: 'kollection.compose.loading', defaultMessage: 'Loading app…' },
  loadError: {
    id: 'kollection.compose.load_error',
    defaultMessage: "Couldn't load this app.",
  },
  name: { id: 'kollection.compose.name', defaultMessage: 'Name' },
  namePlaceholder: {
    id: 'kollection.compose.name_placeholder',
    defaultMessage: 'The app’s name',
  },
  description: {
    id: 'kollection.compose.description',
    defaultMessage: 'What it is',
  },
  descriptionPlaceholder: {
    id: 'kollection.compose.description_placeholder',
    defaultMessage: 'What the app is and what it is for.',
  },
  website: { id: 'kollection.compose.website', defaultMessage: 'Website' },
  websiteHint: {
    id: 'kollection.compose.website_hint',
    defaultMessage: 'Where people open it.',
  },
  icon: { id: 'kollection.compose.icon', defaultMessage: 'Add an icon' },
  iconRemove: {
    id: 'kollection.compose.icon_remove',
    defaultMessage: 'Remove icon',
  },
  iconError: {
    id: 'kollection.compose.icon_error',
    defaultMessage: "Couldn't upload that picture. Try another?",
  },
  signIn: {
    id: 'kollection.compose.sign_in',
    defaultMessage: 'People sign in to it with Kronk',
  },
  signInHint: {
    id: 'kollection.compose.sign_in_hint',
    defaultMessage:
      'It gets a client key and secret for Sign in with Kronk. Leave this off for a link to an app with its own sign-in.',
  },
  signInFixed: {
    id: 'kollection.compose.sign_in_fixed',
    defaultMessage:
      'It signs people in with Kronk. To make it a link instead, remove it and add it again.',
  },
  signInSection: {
    id: 'kollection.compose.sign_in_section',
    defaultMessage: 'Sign in with Kronk',
  },
  redirects: {
    id: 'kollection.compose.redirects',
    defaultMessage: 'Where Kronk sends people back',
  },
  redirectsHint: {
    id: 'kollection.compose.redirects_hint',
    defaultMessage:
      'Its redirect URIs, one per line. An app on the web and a phone app can each have one.',
  },
  scopes: {
    id: 'kollection.compose.scopes',
    defaultMessage: 'What it can see of people',
  },
  needed: {
    id: 'kollection.compose.needed',
    defaultMessage: 'An app needs a name.',
  },
  neededLink: {
    id: 'kollection.compose.needed_link',
    defaultMessage: 'An app that doesn’t sign in with Kronk needs a website.',
  },
  neededRedirect: {
    id: 'kollection.compose.needed_redirect',
    defaultMessage: 'Say where Kronk sends people back after they sign in.',
  },
  errorSave: {
    id: 'kollection.compose.error',
    defaultMessage: "Couldn't save the app. Try again?",
  },
});

// The server's own words for a refusal, else `fallback`.
const errorFrom = (e: unknown, fallback: string): string => {
  const said: unknown = isAxiosError(e)
    ? (e.response?.data as { error?: unknown } | undefined)?.error
    : null;
  return typeof said === 'string' ? said : fallback;
};

// "example.org" means https://example.org.
const withScheme = (url: string): string =>
  /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;

const DEFAULT_SCOPES: KollectionScope[] = ['openid', 'profile'];

interface Props {
  // The app being changed. Absent for a new one.
  editId?: string;
  onCancel: () => void;
  onSaved: (app: ApiKollectionAppJSON) => void;
}

export const AppComposer: React.FC<Props> = ({ editId, onCancel, onSaved }) => {
  const intl = useIntl();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [signIn, setSignIn] = useState(false);
  // Whether it signed in already when the composer opened: then it stays.
  const [signsIn, setSignsIn] = useState(false);
  const [redirects, setRedirects] = useState('');
  const [scopes, setScopes] = useState<KollectionScope[]>(DEFAULT_SCOPES);
  // undefined: untouched. null: removed. A string: an upload's id.
  const [iconId, setIconId] = useState<string | null | undefined>();
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [iconBusy, setIconBusy] = useState(false);

  const [loading, setLoading] = useState(!!editId);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (iconPreview?.startsWith('blob:')) URL.revokeObjectURL(iconPreview);
    },
    [iconPreview],
  );

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;

    apiGetKollectionApp(editId)
      .then((app) => {
        if (cancelled) return undefined;
        setName(app.name);
        setDescription(app.description);
        setWebsite(app.website ?? '');
        setSignIn(app.signs_in);
        setSignsIn(app.signs_in);
        setRedirects((app.redirect_uris ?? []).join('\n'));
        setScopes(app.signs_in ? knownScopes(app.scopes) : DEFAULT_SCOPES);
        setIconPreview(app.icon_url);
        setLoading(false);
        return undefined;
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [editId]);

  const handleName = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setName(e.target.value);
    },
    [],
  );
  const handleDescription = useCallback<
    React.ChangeEventHandler<HTMLTextAreaElement>
  >((e) => {
    setDescription(e.target.value);
  }, []);
  const handleWebsite = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setWebsite(e.target.value);
    },
    [],
  );
  const handleSignIn = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setSignIn(e.target.checked);
    },
    [],
  );
  const handleRedirects = useCallback<
    React.ChangeEventHandler<HTMLTextAreaElement>
  >((e) => {
    setRedirects(e.target.value);
  }, []);
  const handleScope = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      const scope = e.target.value as KollectionScope;
      const on = e.target.checked;
      setScopes((prev) =>
        KOLLECTION_SCOPES.filter((s) => (s === scope ? on : prev.includes(s))),
      );
    },
    [],
  );

  const iconError = intl.formatMessage(messages.iconError);
  const handleIcon = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (!file) return;

      setError(null);
      setIconBusy(true);
      setIconPreview(URL.createObjectURL(file));
      apiUploadListingMedia(file)
        .then((uploaded) => {
          setIconId(uploaded.id);
          return undefined;
        })
        .catch(() => {
          setIconPreview(null);
          setError(iconError);
        })
        .finally(() => {
          setIconBusy(false);
        });
    },
    [iconError],
  );
  const handleIconRemove = useCallback(() => {
    setIconPreview(null);
    setIconId(null);
  }, []);

  const canSubmit = !busy && !iconBusy && !loading && !loadError;

  const errorSave = intl.formatMessage(messages.errorSave);
  const handleSubmit = useCallback(() => {
    const redirectList = redirects
      .split(/\s+/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (name.trim() === '') {
      setError(intl.formatMessage(messages.needed));
      return;
    }
    if (!signIn && website.trim() === '') {
      setError(intl.formatMessage(messages.neededLink));
      return;
    }
    if (signIn && redirectList.length === 0) {
      setError(intl.formatMessage(messages.neededRedirect));
      return;
    }

    setBusy(true);
    setError(null);

    const fields = {
      name: name.trim(),
      description: description.trim(),
      website: website.trim() ? withScheme(website.trim()) : null,
      sign_in: signIn,
      ...(signIn ? { redirect_uris: redirectList.join('\n'), scopes } : {}),
      ...(iconId !== undefined ? { icon_id: iconId } : {}),
    };

    void (async () => {
      try {
        const app = editId
          ? await apiUpdateKollectionApp(editId, fields)
          : await apiCreateKollectionApp(fields);
        onSaved(app);
      } catch (e: unknown) {
        setError(errorFrom(e, errorSave));
        setBusy(false);
      }
    })();
  }, [
    intl,
    name,
    description,
    website,
    signIn,
    redirects,
    scopes,
    iconId,
    editId,
    onSaved,
    errorSave,
  ]);

  return (
    <ComposeShell
      korner='kollection'
      label={intl.formatMessage(
        editId ? messages.titleEdit : messages.titleNew,
      )}
      subtitle={editId ? undefined : intl.formatMessage(messages.subtitle)}
      submitLabel={intl.formatMessage(editId ? messages.save : messages.add)}
      submittingLabel={intl.formatMessage(messages.saving)}
      submitting={busy}
      canSubmit={canSubmit}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      konnect={null}
    >
      {loading && <LoadingState label={intl.formatMessage(messages.loading)} />}
      {loadError && (
        <ComposeHint error>
          <FormattedMessage {...messages.loadError} />
        </ComposeHint>
      )}

      {!loading && !loadError && (
        <>
          <div className='kollection-composer__icon'>
            {iconPreview ? (
              <>
                <img
                  src={iconPreview}
                  alt=''
                  className='kollection-composer__icon-preview'
                />
                <KornerPill
                  label={intl.formatMessage(messages.iconRemove)}
                  onClick={handleIconRemove}
                  disabled={busy || iconBusy}
                />
              </>
            ) : (
              <PhotoDropZone
                onFiles={handleIcon}
                multiple={false}
                disabled={busy || iconBusy}
                label={intl.formatMessage(messages.icon)}
              />
            )}
          </div>

          <ComposeTitle
            value={name}
            onChange={handleName}
            placeholder={intl.formatMessage(messages.namePlaceholder)}
            aria-label={intl.formatMessage(messages.name)}
            maxLength={60}
          />

          <ComposeBody
            value={description}
            onChange={handleDescription}
            placeholder={intl.formatMessage(messages.descriptionPlaceholder)}
            aria-label={intl.formatMessage(messages.description)}
            maxLength={500}
            rows={3}
          />

          <ComposeField
            label={<FormattedMessage {...messages.website} />}
            hint={<FormattedMessage {...messages.websiteHint} />}
          >
            <ComposeInput
              type='url'
              inputMode='url'
              value={website}
              onChange={handleWebsite}
              placeholder='https://'
              maxLength={2000}
            />
          </ComposeField>

          {signsIn ? (
            <ComposeHint>
              <FormattedMessage {...messages.signInFixed} />
            </ComposeHint>
          ) : (
            <ComposeCheck
              label={<FormattedMessage {...messages.signIn} />}
              hint={<FormattedMessage {...messages.signInHint} />}
              checked={signIn}
              onChange={handleSignIn}
            />
          )}

          {signIn && (
            <ComposeSection
              title={<FormattedMessage {...messages.signInSection} />}
            >
              <ComposeField
                label={<FormattedMessage {...messages.redirects} />}
                hint={<FormattedMessage {...messages.redirectsHint} />}
              >
                <ComposeTextarea
                  value={redirects}
                  onChange={handleRedirects}
                  placeholder='https://'
                  rows={3}
                  spellCheck={false}
                  autoCapitalize='off'
                />
              </ComposeField>

              <p className='compose-field__label'>
                <FormattedMessage {...messages.scopes} />
              </p>
              {KOLLECTION_SCOPES.map((scope) => (
                <ComposeCheck
                  key={scope}
                  value={scope}
                  label={intl.formatMessage(scopeMessages[scope])}
                  hint={scope}
                  checked={scopes.includes(scope)}
                  onChange={handleScope}
                />
              ))}
            </ComposeSection>
          )}

          {error && <ComposeHint error>{error}</ComposeHint>}
        </>
      )}
    </ComposeShell>
  );
};
