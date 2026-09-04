import { useEffect, useState, useCallback } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { useHistory, useParams } from 'react-router-dom';

import {
  apiGetKrew,
  apiDetachKorner,
  apiArchiveKrew,
  apiRegenerateInvite,
  apiLeaveKrew,
  apiUpdateKrew,
} from 'mastodon/api/krew';
import type {
  ApiKrewJSON,
  KrewAccess,
  KrewKornerSlug,
} from 'mastodon/api/krew';
import { KornerGlyph } from 'mastodon/components/korner_glyph';
import { Stage } from 'mastodon/components/stage';

// Krew Settings space (/hub/krew/:id/settings) — the management surface
// split out of the detail page (Tal 2026-08-31): the invite link, space
// removal, and archive live here so the Krew page itself stays about
// identity + who's in it + where to go.

const messages = defineMessages({
  title: { id: 'krew.settings.title', defaultMessage: 'Krew settings' },
  loading: { id: 'krew.detail.loading', defaultMessage: 'Loading…' },
  seederNote: {
    id: 'krew.detail.seeder_note',
    defaultMessage:
      "The seeder gathers the Krew and can't remove members. Membership is voluntary.",
  },
  invite: { id: 'krew.detail.invite_heading', defaultMessage: 'Invite link' },
  inviteHint: {
    id: 'krew.detail.invite_hint',
    defaultMessage:
      'Share this link to let people join. Regenerating invalidates the old link.',
  },
  copy: { id: 'krew.detail.invite_copy', defaultMessage: 'Copy' },
  copied: { id: 'krew.detail.invite_copied', defaultMessage: 'Copied' },
  regenerate: {
    id: 'krew.detail.invite_regenerate',
    defaultMessage: 'Regenerate',
  },
  regenerateConfirm: {
    id: 'krew.detail.invite_regenerate_confirm',
    defaultMessage:
      'Regenerate the invite link? Any link you shared with the old token will stop working.',
  },
  spaces: { id: 'krew.settings.spaces', defaultMessage: 'Spaces' },
  spacesHint: {
    id: 'krew.settings.spaces_hint',
    defaultMessage: 'Remove a space to turn it off for this Krew.',
  },
  remove: { id: 'krew.settings.remove_space', defaultMessage: 'Remove' },
  danger: { id: 'krew.settings.danger', defaultMessage: 'Archive' },
  archive: { id: 'krew.detail.archive', defaultMessage: 'Archive this Krew' },
  archiveHint: {
    id: 'krew.settings.archive_hint',
    defaultMessage:
      'Existing posts stay resolvable; new activity is blocked. This cannot be undone.',
  },
  archiveConfirm: {
    id: 'krew.detail.archive_confirm',
    defaultMessage:
      'Archive this krew? Existing posts stay resolvable; new activity is blocked.',
  },
  archived: { id: 'krew.detail.archived', defaultMessage: 'archived' },

  identity: { id: 'krew.settings.identity', defaultMessage: 'Identity' },
  identityHint: {
    id: 'krew.settings.identity_hint',
    defaultMessage: 'Change the Krew name and description.',
  },
  name: { id: 'krew.settings.name', defaultMessage: 'Name' },
  description: {
    id: 'krew.settings.description',
    defaultMessage: 'Description',
  },
  save: { id: 'krew.settings.save', defaultMessage: 'Save' },
  saving: { id: 'krew.settings.saving', defaultMessage: 'Saving…' },
  saved: { id: 'krew.settings.saved', defaultMessage: 'Saved' },

  access: { id: 'krew.settings.access', defaultMessage: 'Access' },
  accessHint: {
    id: 'krew.settings.access_hint',
    defaultMessage: 'Who can join this Krew.',
  },
  accessOpen: { id: 'krew.settings.access_open', defaultMessage: 'Open' },
  accessOpenDesc: {
    id: 'krew.settings.access_open_desc',
    defaultMessage: 'Anyone can join directly.',
  },
  accessInvite: {
    id: 'krew.settings.access_invite',
    defaultMessage: 'Invite-only',
  },
  accessInviteDesc: {
    id: 'krew.settings.access_invite_desc',
    defaultMessage: 'People need an invite link to join.',
  },
  accessGated: {
    id: 'krew.settings.access_gated',
    defaultMessage: 'Requirement-gated',
  },
  accessGatedDesc: {
    id: 'krew.settings.access_gated_desc',
    defaultMessage: 'Add requirements below that people must meet.',
  },

  membership: {
    id: 'krew.settings.membership',
    defaultMessage: 'Membership',
  },
  membershipHint: {
    id: 'krew.settings.membership_hint',
    defaultMessage: 'Leaving is voluntary and takes effect immediately.',
  },
  leave: { id: 'krew.detail.leave', defaultMessage: 'Leave' },
  leaveConfirm: {
    id: 'krew.settings.leave_confirm',
    defaultMessage: 'Leave this Krew? You can re-join later if it stays open.',
  },
});

const SpaceRow: React.FC<{
  slug: KrewKornerSlug;
  onRemove: (slug: KrewKornerSlug) => void;
  disabled: boolean;
}> = ({ slug, onRemove, disabled }) => {
  const intl = useIntl();
  const handle = useCallback(() => {
    onRemove(slug);
  }, [slug, onRemove]);
  return (
    <li className='krew-settings__space-row'>
      <KornerGlyph
        slug={slug}
        className='krew-settings__space-glyph'
        aria-hidden='true'
      />
      <span className='krew-settings__space-name'>{slug}</span>
      <button
        type='button'
        onClick={handle}
        disabled={disabled}
        className='krew-detail__btn krew-detail__btn--ghost'
      >
        {intl.formatMessage(messages.remove)}
      </button>
    </li>
  );
};

const ACCESS_CHOICES: {
  key: KrewAccess;
  label: keyof typeof messages;
  desc: keyof typeof messages;
}[] = [
  { key: 'open', label: 'accessOpen', desc: 'accessOpenDesc' },
  { key: 'invite_only', label: 'accessInvite', desc: 'accessInviteDesc' },
  { key: 'requirement_gated', label: 'accessGated', desc: 'accessGatedDesc' },
];

export const KrewSettings = () => {
  const intl = useIntl();
  const history = useHistory();
  const { id } = useParams<{ id?: string }>();
  const [krew, setKrew] = useState<ApiKrewJSON | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  // Identity form — kept in local state so a `Save` is explicit.
  // Seeded from the loaded Krew and re-seeded when it changes.
  const [nameDraft, setNameDraft] = useState('');
  const [descDraft, setDescDraft] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);

  const refetch = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const next = await apiGetKrew(id);
      setKrew(next);
      setNameDraft(next.name);
      setDescDraft(next.description ?? '');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const handleRemove = useCallback(
    (slug: KrewKornerSlug) => {
      if (!id) return;
      setBusy(true);
      apiDetachKorner(id, slug)
        .then(refetch)
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [id, refetch],
  );

  const handleRegenerate = useCallback(() => {
    if (!id) return;
    if (!window.confirm(intl.formatMessage(messages.regenerateConfirm))) return;
    setBusy(true);
    apiRegenerateInvite(id)
      .then(refetch)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        setBusy(false);
      });
  }, [id, intl, refetch]);

  const handleArchive = useCallback(() => {
    if (!id) return;
    if (!window.confirm(intl.formatMessage(messages.archiveConfirm))) return;
    setBusy(true);
    apiArchiveKrew(id)
      .then(refetch)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        setBusy(false);
      });
  }, [id, intl, refetch]);

  const handleSaveIdentity = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!id) return;
      setBusy(true);
      apiUpdateKrew(id, {
        name: nameDraft.trim(),
        description: descDraft.trim(),
      })
        .then((next) => {
          setKrew(next);
          setNameDraft(next.name);
          setDescDraft(next.description ?? '');
          setSavedFlash(true);
          window.setTimeout(() => {
            setSavedFlash(false);
          }, 1500);
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [id, nameDraft, descDraft],
  );

  const handleNameChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setNameDraft(e.currentTarget.value);
  }, []);

  const handleDescChange = useCallback<
    React.ChangeEventHandler<HTMLTextAreaElement>
  >((e) => {
    setDescDraft(e.currentTarget.value);
  }, []);

  const handleAccessRadioChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >(
    (e) => {
      const next = e.currentTarget.value as KrewAccess;
      if (!id || !krew || krew.access === next) return;
      setBusy(true);
      apiUpdateKrew(id, { access: next })
        .then(setKrew)
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [id, krew],
  );

  const handleLeave = useCallback(() => {
    if (!id) return;
    if (!window.confirm(intl.formatMessage(messages.leaveConfirm))) return;
    setBusy(true);
    apiLeaveKrew(id)
      .then(() => {
        // Leaving strips your access to the Krew's private surfaces, so
        // stay off /hub/krew/:id/settings — back to the Krews landing.
        history.push('/hub/krew');
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
        setBusy(false);
      });
  }, [id, intl, history]);

  const inviteUrl =
    krew?.invite_token && krew.slug
      ? `${window.location.origin}/hub/krew/${krew.slug}?k=${encodeURIComponent(krew.invite_token)}`
      : null;

  const handleCopy = useCallback(() => {
    if (!inviteUrl) return;
    void navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1500);
    });
  }, [inviteUrl]);

  const isSeeder = krew?.viewer_role === 'seeder';

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <div className='scrollable krew-settings'>
        {error && <p className='krew-detail__error'>{error}</p>}

        {!krew && !error && (
          <p className='krew-detail__loading'>
            <FormattedMessage {...messages.loading} />
          </p>
        )}

        {krew && (
          <>
            <h1 className='krew-settings__title'>
              {krew.name}
              {krew.archived && (
                <span className='krew-detail__archived-badge'>
                  <FormattedMessage {...messages.archived} />
                </span>
              )}
            </h1>

            <p className='krew-detail__seeder-note'>
              <FormattedMessage {...messages.seederNote} />
            </p>

            {isSeeder && !krew.archived && (
              <section className='krew-settings__section'>
                <h3 className='krew-detail__section-heading'>
                  <FormattedMessage {...messages.identity} />
                </h3>
                <p className='krew-detail__section-hint'>
                  <FormattedMessage {...messages.identityHint} />
                </p>
                <form
                  className='krew-settings__identity-form'
                  onSubmit={handleSaveIdentity}
                >
                  <label className='krew-settings__field'>
                    <span className='krew-settings__field-label'>
                      <FormattedMessage {...messages.name} />
                    </span>
                    <input
                      type='text'
                      value={nameDraft}
                      onChange={handleNameChange}
                      disabled={busy}
                      required
                      maxLength={80}
                      className='krew-settings__input'
                    />
                  </label>
                  <label className='krew-settings__field'>
                    <span className='krew-settings__field-label'>
                      <FormattedMessage {...messages.description} />
                    </span>
                    <textarea
                      value={descDraft}
                      onChange={handleDescChange}
                      disabled={busy}
                      rows={3}
                      maxLength={500}
                      className='krew-settings__input krew-settings__input--multiline'
                    />
                  </label>
                  <div className='krew-settings__field-actions'>
                    <button
                      type='submit'
                      disabled={
                        busy ||
                        (nameDraft.trim() === krew.name &&
                          descDraft.trim() === (krew.description ?? ''))
                      }
                      className='krew-detail__btn krew-detail__btn--primary'
                    >
                      {busy ? (
                        <FormattedMessage {...messages.saving} />
                      ) : savedFlash ? (
                        <FormattedMessage {...messages.saved} />
                      ) : (
                        <FormattedMessage {...messages.save} />
                      )}
                    </button>
                  </div>
                </form>
              </section>
            )}

            {isSeeder && !krew.archived && (
              <section className='krew-settings__section'>
                <h3 className='krew-detail__section-heading'>
                  <FormattedMessage {...messages.access} />
                </h3>
                <p className='krew-detail__section-hint'>
                  <FormattedMessage {...messages.accessHint} />
                </p>
                <ul className='krew-settings__access-choices'>
                  {ACCESS_CHOICES.map((choice) => (
                    <li key={choice.key}>
                      <label
                        aria-label={intl.formatMessage(messages[choice.label])}
                        className={`krew-settings__access-choice${
                          krew.access === choice.key
                            ? ' krew-settings__access-choice--active'
                            : ''
                        }`}
                      >
                        <input
                          type='radio'
                          name='krew-access'
                          value={choice.key}
                          checked={krew.access === choice.key}
                          disabled={busy}
                          onChange={handleAccessRadioChange}
                          className='krew-settings__access-radio'
                        />
                        <span className='krew-settings__access-body'>
                          <span className='krew-settings__access-label'>
                            <FormattedMessage {...messages[choice.label]} />
                          </span>
                          <span className='krew-settings__access-desc'>
                            <FormattedMessage {...messages[choice.desc]} />
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {inviteUrl && !krew.archived && (
              <section className='krew-settings__section'>
                <h3 className='krew-detail__section-heading'>
                  <FormattedMessage {...messages.invite} />
                </h3>
                <p className='krew-detail__section-hint'>
                  <FormattedMessage {...messages.inviteHint} />
                </p>
                <div className='krew-detail__invite-row'>
                  <input
                    type='text'
                    readOnly
                    value={inviteUrl}
                    className='krew-detail__invite-input'
                    aria-label={intl.formatMessage(messages.invite)}
                  />
                  <button
                    type='button'
                    onClick={handleCopy}
                    className='krew-detail__btn krew-detail__btn--secondary'
                  >
                    {copied
                      ? intl.formatMessage(messages.copied)
                      : intl.formatMessage(messages.copy)}
                  </button>
                  <button
                    type='button'
                    onClick={handleRegenerate}
                    disabled={busy}
                    className='krew-detail__btn krew-detail__btn--ghost'
                  >
                    <FormattedMessage {...messages.regenerate} />
                  </button>
                </div>
              </section>
            )}

            {isSeeder && krew.korners.length > 0 && (
              <section className='krew-settings__section'>
                <h3 className='krew-detail__section-heading'>
                  <FormattedMessage {...messages.spaces} />
                </h3>
                <p className='krew-detail__section-hint'>
                  <FormattedMessage {...messages.spacesHint} />
                </p>
                <ul className='krew-settings__space-list'>
                  {krew.korners.map((slug) => (
                    <SpaceRow
                      key={slug}
                      slug={slug}
                      onRemove={handleRemove}
                      disabled={busy}
                    />
                  ))}
                </ul>
              </section>
            )}

            {krew.viewer_role && !krew.archived && (
              <section className='krew-settings__section'>
                <h3 className='krew-detail__section-heading'>
                  <FormattedMessage {...messages.membership} />
                </h3>
                <p className='krew-detail__section-hint'>
                  <FormattedMessage {...messages.membershipHint} />
                </p>
                <button
                  type='button'
                  onClick={handleLeave}
                  disabled={busy}
                  className='krew-detail__btn krew-detail__btn--secondary'
                >
                  <FormattedMessage {...messages.leave} />
                </button>
              </section>
            )}

            {isSeeder && !krew.archived && (
              <section className='krew-settings__section krew-settings__section--danger'>
                <h3 className='krew-detail__section-heading'>
                  <FormattedMessage {...messages.danger} />
                </h3>
                <p className='krew-detail__section-hint'>
                  <FormattedMessage {...messages.archiveHint} />
                </p>
                <button
                  type='button'
                  onClick={handleArchive}
                  disabled={busy}
                  className='krew-detail__btn krew-detail__btn--danger'
                >
                  <FormattedMessage {...messages.archive} />
                </button>
              </section>
            )}
          </>
        )}
      </div>
    </Stage>
  );
};
