import { useCallback, useEffect, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { isAxiosError } from 'axios';

import {
  KOLLECTION_CATEGORIES,
  KOLLECTION_PLATFORMS,
  KOLLECTION_SCOPES,
  apiCreateKollectionApp,
  apiGetKollectionApp,
  apiRemoveKollectionApp,
  apiUpdateKollectionApp,
  isKollectionCategory,
  isKollectionPlatform,
} from 'mastodon/api/kollection';
import type {
  ApiKollectionAppJSON,
  KollectionCategory,
  KollectionPlatform,
  KollectionScope,
} from 'mastodon/api/kollection';
import { apiUploadListingMedia } from 'mastodon/api/wachuneed';
import {
  ComposeBody,
  ComposeCheck,
  ComposeField,
  ComposeHint,
  ComposeInput,
  ComposeRow,
  ComposeSection,
  ComposeSelect,
  ComposeTextarea,
  ComposeTitle,
} from 'mastodon/components/compose_fields';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LoadingState } from 'mastodon/components/loading_state';
import { PhotoDropZone } from 'mastodon/components/media';
import { useConfirmDialog } from 'mastodon/hooks/useConfirmDialog';

import { categoryMessages, platformMessages } from './details';
import { knownScopes, scopeMessages } from './scopes';

// Add an app to Kollection, or change one you keep
// (docs/spaces/kollection.md). The standard composer overlay with the kit:
// what its app store style page shows (an icon, a cover, the name, a
// tagline, what it is, who made it, a category, where it runs, up to six
// screenshots in order), its website, and whether it signs people in with
// Kronk. Editing ends with Remove this app, which asks first. One that does takes where Kronk sends people back (one
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
  tagline: { id: 'kollection.compose.tagline', defaultMessage: 'Tagline' },
  taglineHint: {
    id: 'kollection.compose.tagline_hint',
    defaultMessage: 'One short line under its name.',
  },
  madeBy: { id: 'kollection.compose.made_by', defaultMessage: 'Made by' },
  category: { id: 'kollection.compose.category', defaultMessage: 'Category' },
  categoryNone: {
    id: 'kollection.compose.category_none',
    defaultMessage: 'No category',
  },
  platforms: {
    id: 'kollection.compose.platforms',
    defaultMessage: 'Works on',
  },
  cover: { id: 'kollection.compose.cover', defaultMessage: 'Add a cover' },
  coverRemove: {
    id: 'kollection.compose.cover_remove',
    defaultMessage: 'Remove cover',
  },
  screenshots: {
    id: 'kollection.compose.screenshots',
    defaultMessage: 'Screenshots',
  },
  screenshotsHint: {
    id: 'kollection.compose.screenshots_hint',
    defaultMessage:
      'Up to {max}, in the order they show. Remove one and add it again to move it to the end.',
  },
  screenshotsAdd: {
    id: 'kollection.compose.screenshots_add',
    defaultMessage: 'Add screenshots',
  },
  screenshotRemove: {
    id: 'kollection.compose.screenshot_remove',
    defaultMessage: 'Remove screenshot',
  },
  remove: {
    id: 'kollection.compose.remove',
    defaultMessage: 'Remove this app',
  },
  removeTitle: {
    id: 'kollection.app.remove_title',
    defaultMessage: 'Remove {name}?',
  },
  removeBody: {
    id: 'kollection.app.remove_body',
    defaultMessage:
      'It leaves Kollection, everyone connected to it is signed out of it, and its keys stop working. This can’t be undone.',
  },
  removeConfirm: { id: 'kollection.app.remove', defaultMessage: 'Remove' },
  removeError: {
    id: 'kollection.app.error',
    defaultMessage: 'That didn’t work. Try again?',
  },
});

// At most this many screenshots (KollectionApp::SCREENSHOTS_LIMIT).
const MAX_SCREENSHOTS = 6;

// A screenshot in the composer: an upload on its way (no id yet) or done.
interface Shot {
  key: string;
  id: string | null;
  preview: string;
}

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
  // Removed (from editing): where to go now.
  onRemoved?: () => void;
}

export const AppComposer: React.FC<Props> = ({
  editId,
  onCancel,
  onSaved,
  onRemoved,
}) => {
  const intl = useIntl();
  const [confirmDialog, confirm] = useConfirmDialog();

  const [tagline, setTagline] = useState('');
  const [madeBy, setMadeBy] = useState('');
  const [category, setCategory] = useState<KollectionCategory | ''>('');
  const [platforms, setPlatforms] = useState<KollectionPlatform[]>([]);
  // As the icon: undefined untouched, null removed, a string an upload.
  const [coverId, setCoverId] = useState<string | null | undefined>();
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  // Whether the screenshots were touched: only then are they sent.
  const [shotsTouched, setShotsTouched] = useState(false);

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
  useEffect(
    () => () => {
      if (coverPreview?.startsWith('blob:')) URL.revokeObjectURL(coverPreview);
    },
    [coverPreview],
  );

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;

    apiGetKollectionApp(editId)
      .then((app) => {
        if (cancelled) return undefined;
        setName(app.name);
        setTagline(app.tagline);
        setMadeBy(app.made_by);
        setCategory(isKollectionCategory(app.category) ? app.category : '');
        setPlatforms(app.platforms.filter(isKollectionPlatform));
        setCoverPreview(app.cover_url);
        setShots(
          (app.screenshots ?? []).map((shot) => ({
            key: shot.id,
            id: shot.id,
            preview: shot.preview_url,
          })),
        );
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
  const handleTagline = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setTagline(e.target.value);
    },
    [],
  );
  const handleMadeBy = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setMadeBy(e.target.value);
    },
    [],
  );
  const handleCategory = useCallback<
    React.ChangeEventHandler<HTMLSelectElement>
  >((e) => {
    const value = e.target.value;
    setCategory(isKollectionCategory(value) ? value : '');
  }, []);
  const handlePlatform = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    const value = e.target.value;
    const on = e.target.checked;
    setPlatforms((prev) =>
      KOLLECTION_PLATFORMS.filter((p) => (p === value ? on : prev.includes(p))),
    );
  }, []);
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
  const handleCover = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (!file) return;

      setError(null);
      setCoverBusy(true);
      setCoverPreview(URL.createObjectURL(file));
      apiUploadListingMedia(file)
        .then((uploaded) => {
          setCoverId(uploaded.id);
          return undefined;
        })
        .catch(() => {
          setCoverPreview(null);
          setError(iconError);
        })
        .finally(() => {
          setCoverBusy(false);
        });
    },
    [iconError],
  );
  const handleCoverRemove = useCallback(() => {
    setCoverPreview(null);
    setCoverId(null);
  }, []);

  const handleShots = useCallback(
    (files: File[]) => {
      setError(null);
      setShotsTouched(true);
      const room = MAX_SCREENSHOTS - shots.length;
      files.slice(0, Math.max(room, 0)).forEach((file, i) => {
        const key = `new-${Date.now()}-${i}`;
        setShots((prev) => [
          ...prev,
          { key, id: null, preview: URL.createObjectURL(file) },
        ]);
        apiUploadListingMedia(file)
          .then((uploaded) => {
            setShots((prev) =>
              prev.map((s) => (s.key === key ? { ...s, id: uploaded.id } : s)),
            );
            return undefined;
          })
          .catch(() => {
            setShots((prev) => prev.filter((s) => s.key !== key));
            setError(iconError);
          });
      });
    },
    [shots.length, iconError],
  );
  const handleShotRemove = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const key = e.currentTarget.dataset.key;
      setShotsTouched(true);
      setShots((prev) => prev.filter((s) => s.key !== key));
    },
    [],
  );
  const shotsBusy = shots.some((s) => s.id === null);

  const handleIconRemove = useCallback(() => {
    setIconPreview(null);
    setIconId(null);
  }, []);

  const canSubmit =
    !busy && !iconBusy && !coverBusy && !shotsBusy && !loading && !loadError;

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
      tagline: tagline.trim(),
      made_by: madeBy.trim(),
      category: category || null,
      platforms,
      description: description.trim(),
      website: website.trim() ? withScheme(website.trim()) : null,
      sign_in: signIn,
      ...(signIn ? { redirect_uris: redirectList.join('\n'), scopes } : {}),
      ...(iconId !== undefined ? { icon_id: iconId } : {}),
      ...(coverId !== undefined ? { cover_id: coverId } : {}),
      ...(shotsTouched
        ? { screenshot_ids: shots.flatMap((s) => (s.id ? [s.id] : [])) }
        : {}),
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
    coverId,
    shots,
    shotsTouched,
    tagline,
    madeBy,
    category,
    platforms,
    editId,
    onSaved,
    errorSave,
  ]);

  const removeError = intl.formatMessage(messages.removeError);
  const handleRemove = useCallback(() => {
    if (!editId) return;

    void (async () => {
      const ok = await confirm({
        title: intl.formatMessage(messages.removeTitle, { name: name.trim() }),
        message: intl.formatMessage(messages.removeBody),
        confirmLabel: intl.formatMessage(messages.removeConfirm),
        destructive: true,
      });
      if (!ok) return;

      setBusy(true);
      setError(null);
      try {
        await apiRemoveKollectionApp(editId);
        onRemoved?.();
      } catch {
        setError(removeError);
        setBusy(false);
      }
    })();
  }, [confirm, editId, intl, name, onRemoved, removeError]);

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
      footerStart={
        editId ? (
          <KornerPill
            variant='destructive'
            label={intl.formatMessage(messages.remove)}
            onClick={handleRemove}
            disabled={busy}
          />
        ) : undefined
      }
    >
      {confirmDialog}
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

          <div className='kollection-composer__cover'>
            {coverPreview ? (
              <>
                <img
                  src={coverPreview}
                  alt=''
                  className='kollection-composer__cover-preview'
                />
                <KornerPill
                  label={intl.formatMessage(messages.coverRemove)}
                  onClick={handleCoverRemove}
                  disabled={busy || coverBusy}
                />
              </>
            ) : (
              <PhotoDropZone
                onFiles={handleCover}
                multiple={false}
                disabled={busy || coverBusy}
                label={intl.formatMessage(messages.cover)}
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

          <ComposeField
            label={<FormattedMessage {...messages.tagline} />}
            hint={<FormattedMessage {...messages.taglineHint} />}
          >
            <ComposeInput
              value={tagline}
              onChange={handleTagline}
              maxLength={100}
            />
          </ComposeField>

          <ComposeBody
            value={description}
            onChange={handleDescription}
            placeholder={intl.formatMessage(messages.descriptionPlaceholder)}
            aria-label={intl.formatMessage(messages.description)}
            maxLength={4000}
            rows={5}
          />

          <ComposeSection
            title={<FormattedMessage {...messages.screenshots} />}
          >
            <ComposeHint>
              <FormattedMessage
                {...messages.screenshotsHint}
                values={{ max: MAX_SCREENSHOTS }}
              />
            </ComposeHint>
            {shots.length > 0 && (
              <ul className='kollection-composer__shots'>
                {shots.map((shot) => (
                  <li key={shot.key} className='kollection-composer__shot'>
                    <img src={shot.preview} alt='' />
                    <button
                      type='button'
                      className='kollection-composer__shot-remove'
                      data-key={shot.key}
                      onClick={handleShotRemove}
                      disabled={busy}
                      aria-label={intl.formatMessage(messages.screenshotRemove)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {shots.length < MAX_SCREENSHOTS && (
              <PhotoDropZone
                onFiles={handleShots}
                multiple
                disabled={busy}
                label={intl.formatMessage(messages.screenshotsAdd)}
              />
            )}
          </ComposeSection>

          <ComposeRow>
            <ComposeField label={<FormattedMessage {...messages.madeBy} />}>
              <ComposeInput
                value={madeBy}
                onChange={handleMadeBy}
                maxLength={80}
              />
            </ComposeField>
            <ComposeField label={<FormattedMessage {...messages.category} />}>
              <ComposeSelect value={category} onChange={handleCategory}>
                <option value=''>
                  {intl.formatMessage(messages.categoryNone)}
                </option>
                {KOLLECTION_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {intl.formatMessage(categoryMessages[value])}
                  </option>
                ))}
              </ComposeSelect>
            </ComposeField>
          </ComposeRow>

          <p className='compose-field__label'>
            <FormattedMessage {...messages.platforms} />
          </p>
          {KOLLECTION_PLATFORMS.map((platform) => (
            <ComposeCheck
              key={platform}
              value={platform}
              label={intl.formatMessage(platformMessages[platform])}
              checked={platforms.includes(platform)}
              onChange={handlePlatform}
            />
          ))}

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
