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
  apiAddRequirement,
  apiRemoveRequirement,
} from 'mastodon/api/krew';
import type {
  ApiKrewJSON,
  KrewAccess,
  KrewKornerSlug,
  KrewRequirementInput,
  ApiKrewRequirementJSON,
} from 'mastodon/api/krew';
import { AllSettingsFooter } from 'mastodon/components/all_settings_footer';
import { KornerGlyph } from 'mastodon/components/korner_glyph';
import { Stage } from 'mastodon/components/stage';
import { SettingsRadioCards } from 'mastodon/features/settings/radio_cards';
import { SettingsSection } from 'mastodon/features/settings/section';

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

  requirements: {
    id: 'krew.settings.requirements',
    defaultMessage: 'Requirements to join',
  },
  requirementsHint: {
    id: 'krew.settings.requirements_hint',
    defaultMessage:
      'Applicants must satisfy every requirement. Rows are ANDed — added, removed here take effect immediately.',
  },
  requirementsGatedOnly: {
    id: 'krew.settings.requirements_gated_only',
    defaultMessage:
      'Only active while Access is set to Requirement-gated (see above). Set it there first, or add the rules now and switch when ready.',
  },
  reqKind: { id: 'krew.settings.req_kind', defaultMessage: 'Kind' },
  reqKindLocatedIn: {
    id: 'krew.settings.req_kind.located_in',
    defaultMessage: 'Located in a region',
  },
  reqKindAttendingEvent: {
    id: 'krew.settings.req_kind.attending_event',
    defaultMessage: 'Attending an event',
  },
  reqRegion: {
    id: 'krew.settings.req_region',
    defaultMessage: 'Region (e.g. Melbourne)',
  },
  reqEventId: { id: 'krew.settings.req_event_id', defaultMessage: 'Event ID' },
  reqAdd: { id: 'krew.settings.req_add', defaultMessage: 'Add requirement' },
  reqRowLocatedIn: {
    id: 'krew.settings.req_row.located_in',
    defaultMessage: 'Located in {value}',
  },
  reqRowAttendingEvent: {
    id: 'krew.settings.req_row.attending_event',
    defaultMessage: 'RSVPed to event #{value}',
  },
  reqRowVouched: {
    id: 'krew.settings.req_row.vouched_by_member',
    defaultMessage: 'Vouched by a member',
  },
  reqRemove: { id: 'krew.settings.req_remove', defaultMessage: 'Remove' },
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

// The two requirement kinds authoring is supported for on Settings.
// `vouched_by_member` is provisional per KrewRequirement's docstring —
// feature-flagged pending DIDs — so it's readable in the list but not
// added from this UI.
type SettableReqKind = 'located_in' | 'attending_event';

// Human-readable rendering for an existing requirement row. Falls back
// to the raw kind label if the value slot is empty.
const requirementSummary = (
  req: ApiKrewRequirementJSON,
  intl: ReturnType<typeof useIntl>,
): string => {
  switch (req.kind) {
    case 'located_in':
      return intl.formatMessage(messages.reqRowLocatedIn, {
        value: req.region ?? '—',
      });
    case 'attending_event':
      return intl.formatMessage(messages.reqRowAttendingEvent, {
        value: req.event_id ?? '—',
      });
    case 'vouched_by_member':
      return intl.formatMessage(messages.reqRowVouched);
  }
};

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

  // Add-a-requirement form — kind + a single value field the shape
  // of which depends on the kind. Cleared on successful add.
  const [newReqKind, setNewReqKind] = useState<SettableReqKind>('located_in');
  const [newReqValue, setNewReqValue] = useState('');

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

  const handleAccessChange = useCallback(
    (next: KrewAccess) => {
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

  const handleNewReqKindChange = useCallback<
    React.ChangeEventHandler<HTMLSelectElement>
  >((e) => {
    setNewReqKind(e.currentTarget.value as SettableReqKind);
    setNewReqValue('');
  }, []);

  const handleNewReqValueChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setNewReqValue(e.currentTarget.value);
  }, []);

  const handleAddReq = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!id) return;
      const value = newReqValue.trim();
      if (!value) return;

      const payload: KrewRequirementInput =
        newReqKind === 'located_in'
          ? { kind: 'located_in', region: value }
          : { kind: 'attending_event', event_id: value };

      setBusy(true);
      apiAddRequirement(id, payload)
        .then((next) => {
          setKrew(next);
          setNewReqValue('');
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [id, newReqKind, newReqValue],
  );

  const handleRemoveReq = useCallback<
    React.MouseEventHandler<HTMLButtonElement>
  >(
    (e) => {
      if (!id) return;
      const reqId = e.currentTarget.dataset.reqId;
      if (!reqId) return;
      setBusy(true);
      apiRemoveRequirement(id, reqId)
        .then(setKrew)
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [id],
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
              <SettingsSection
                heading={<FormattedMessage {...messages.identity} />}
                hint={<FormattedMessage {...messages.identityHint} />}
              >
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
              </SettingsSection>
            )}

            {isSeeder && !krew.archived && (
              <SettingsSection
                heading={<FormattedMessage {...messages.access} />}
                hint={<FormattedMessage {...messages.accessHint} />}
              >
                <SettingsRadioCards<KrewAccess>
                  name='krew-access'
                  value={krew.access}
                  onChange={handleAccessChange}
                  disabled={busy}
                  ariaLabel={intl.formatMessage(messages.access)}
                  choices={ACCESS_CHOICES.map((choice) => ({
                    key: choice.key,
                    label: <FormattedMessage {...messages[choice.label]} />,
                    description: (
                      <FormattedMessage {...messages[choice.desc]} />
                    ),
                  }))}
                />
              </SettingsSection>
            )}

            {isSeeder && !krew.archived && (
              <SettingsSection
                heading={<FormattedMessage {...messages.requirements} />}
                hint={<FormattedMessage {...messages.requirementsHint} />}
              >
                {krew.access !== 'requirement_gated' && (
                  <p className='krew-settings__req-inactive-note'>
                    <FormattedMessage {...messages.requirementsGatedOnly} />
                  </p>
                )}

                {krew.requirements.length > 0 && (
                  <ul className='krew-settings__req-list'>
                    {krew.requirements.map((req) => (
                      <li key={req.id} className='krew-settings__req-row'>
                        <span className='krew-settings__req-summary'>
                          {requirementSummary(req, intl)}
                        </span>
                        <button
                          type='button'
                          data-req-id={req.id}
                          onClick={handleRemoveReq}
                          disabled={busy}
                          className='krew-detail__btn krew-detail__btn--ghost'
                        >
                          <FormattedMessage {...messages.reqRemove} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <form
                  className='krew-settings__req-add'
                  onSubmit={handleAddReq}
                >
                  <label className='krew-settings__field'>
                    <span className='krew-settings__field-label'>
                      <FormattedMessage {...messages.reqKind} />
                    </span>
                    <select
                      value={newReqKind}
                      onChange={handleNewReqKindChange}
                      disabled={busy}
                      className='krew-settings__input'
                    >
                      <option value='located_in'>
                        {intl.formatMessage(messages.reqKindLocatedIn)}
                      </option>
                      <option value='attending_event'>
                        {intl.formatMessage(messages.reqKindAttendingEvent)}
                      </option>
                    </select>
                  </label>
                  <label className='krew-settings__field'>
                    <span className='krew-settings__field-label'>
                      {newReqKind === 'located_in'
                        ? intl.formatMessage(messages.reqRegion)
                        : intl.formatMessage(messages.reqEventId)}
                    </span>
                    <input
                      type={
                        newReqKind === 'attending_event' ? 'number' : 'text'
                      }
                      inputMode={
                        newReqKind === 'attending_event' ? 'numeric' : 'text'
                      }
                      value={newReqValue}
                      onChange={handleNewReqValueChange}
                      disabled={busy}
                      required
                      maxLength={120}
                      className='krew-settings__input'
                    />
                  </label>
                  <div className='krew-settings__field-actions'>
                    <button
                      type='submit'
                      disabled={busy || !newReqValue.trim()}
                      className='krew-detail__btn krew-detail__btn--primary'
                    >
                      <FormattedMessage {...messages.reqAdd} />
                    </button>
                  </div>
                </form>
              </SettingsSection>
            )}

            {inviteUrl && !krew.archived && (
              <SettingsSection
                heading={<FormattedMessage {...messages.invite} />}
                hint={<FormattedMessage {...messages.inviteHint} />}
              >
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
              </SettingsSection>
            )}

            {isSeeder && krew.korners.length > 0 && (
              <SettingsSection
                heading={<FormattedMessage {...messages.spaces} />}
                hint={<FormattedMessage {...messages.spacesHint} />}
              >
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
              </SettingsSection>
            )}

            {krew.viewer_role && !krew.archived && (
              <SettingsSection
                heading={<FormattedMessage {...messages.membership} />}
                hint={<FormattedMessage {...messages.membershipHint} />}
              >
                <button
                  type='button'
                  onClick={handleLeave}
                  disabled={busy}
                  className='krew-detail__btn krew-detail__btn--secondary'
                >
                  <FormattedMessage {...messages.leave} />
                </button>
              </SettingsSection>
            )}

            {isSeeder && !krew.archived && (
              <SettingsSection
                variant='danger'
                heading={<FormattedMessage {...messages.danger} />}
                hint={<FormattedMessage {...messages.archiveHint} />}
              >
                <button
                  type='button'
                  onClick={handleArchive}
                  disabled={busy}
                  className='krew-detail__btn krew-detail__btn--danger'
                >
                  <FormattedMessage {...messages.archive} />
                </button>
              </SettingsSection>
            )}
          </>
        )}

        <AllSettingsFooter />
      </div>
    </Stage>
  );
};
