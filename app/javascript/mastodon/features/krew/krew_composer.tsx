import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import PhotoCameraIcon from '@/material-icons/400-24px/photo_camera.svg?react';
import { apiCreateKrew, apiSetKrewImage } from 'mastodon/api/krew';
import type {
  ApiKrewJSON,
  KrewAccess,
  KrewRequirementInput,
} from 'mastodon/api/krew';
import type { ApiComposerDraftJSON } from 'mastodon/api_types/drafts';
import { AccountMultiSelect } from 'mastodon/components/account_multi_select';
import type { AccountLite } from 'mastodon/components/account_multi_select';
import {
  ComposeBody,
  ComposeField,
  ComposeHint,
  ComposeInput,
  ComposeSection,
  ComposeSelect,
  ComposeTitle,
} from 'mastodon/components/compose_fields';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { EventSearch } from 'mastodon/components/event_search';
import type { PickedEvent } from 'mastodon/components/event_search';
import { useDraft } from 'mastodon/hooks/useDraft';
import type { KonnectTarget } from 'mastodon/hooks/useKonnect';
import { useKonnect } from 'mastodon/hooks/useKonnect';

import { KrewPhotoField } from './krew_photo_field';

// Start a Krew (/hub/krew/composer) — the standard `<ComposeShell>`
// overlay mounted on top of the Krews directory. Was the full-page
// `KrewNew` at /hub/krew/new until 2026-08-12; /hub/krew/new is now
// a legacy alias resolving to the same overlay (see the ui/index.jsx
// routes + docs/decisions.md 2026-08-12 entry).
//
// The requirement builder and the people to invite go in the create
// payload; the backend picks them up in a single transaction. What the
// Krew has (albums, events, a Huddle) is the Konnect row: Konnecting or
// making one turns that space on (decisions.md, 2026-10-25 and
// 2026-10-27), so there is no separate list of spaces to tick.

const messages = defineMessages({
  label: { id: 'krew.new.title', defaultMessage: 'Gather a Krew' },
  intro: {
    id: 'krew.new.intro',
    defaultMessage: 'Bring Krew together.',
  },
  identity: { id: 'krew.new.identity', defaultMessage: 'Identity' },
  photo: { id: 'krew.photo', defaultMessage: 'Photo' },
  photoChoose: { id: 'krew.photo.choose', defaultMessage: 'Choose a photo' },
  photoHint: {
    id: 'krew.new.photo_hint',
    defaultMessage: 'Optional. Tap the square to choose one.',
  },
  photoRemove: { id: 'krew.photo.remove', defaultMessage: 'Remove photo' },
  name: { id: 'krew.new.name', defaultMessage: 'Name' },
  namePlaceholder: {
    id: 'krew.new.name_placeholder',
    defaultMessage: 'What are these people?',
  },
  description: { id: 'krew.new.description', defaultMessage: 'Description' },
  descriptionPlaceholder: {
    id: 'krew.new.description_placeholder',
    defaultMessage: "What's this Krew for?",
  },
  access: { id: 'krew.new.access', defaultMessage: 'Access' },
  // The same words as Krew settings' Access (krew_settings.tsx).
  accessOpen: { id: 'krew.new.access_open', defaultMessage: 'Open' },
  accessOpenDesc: {
    id: 'krew.new.access_open_desc',
    defaultMessage: 'Anyone can find it and join.',
  },
  accessApproval: {
    id: 'krew.new.access_approval',
    defaultMessage: 'Ask to join',
  },
  accessApprovalDesc: {
    id: 'krew.new.access_approval_desc',
    defaultMessage: 'Anyone can find it and ask. Any member can let them in.',
  },
  accessInviteOnly: {
    id: 'krew.new.access_invite',
    defaultMessage: 'Invite-only',
  },
  accessInviteOnlyDesc: {
    id: 'krew.new.access_invite_desc',
    defaultMessage: 'Hidden. Only people a member brings in can join.',
  },
  accessGated: {
    id: 'krew.new.access_gated',
    defaultMessage: 'Has requirements',
  },
  accessGatedDesc: {
    id: 'krew.new.access_gated_desc',
    defaultMessage:
      'Anyone can find it. People who meet what you set can join.',
  },
  people: { id: 'krew.new.people', defaultMessage: 'People' },
  peopleHint: {
    id: 'krew.new.people_hint',
    defaultMessage:
      'Invite people to join. They get a nudge with a link — nobody joins without choosing to.',
  },
  requirements: {
    id: 'krew.new.requirements',
    defaultMessage: 'Requirements to join',
  },
  requirementsHint: {
    id: 'krew.new.requirements_hint',
    defaultMessage: 'People need to meet every one of these to join.',
  },
  addRequirement: {
    id: 'krew.new.add_requirement',
    defaultMessage: '+ Add requirement',
  },
  removeRow: { id: 'krew.new.remove_row', defaultMessage: 'Remove' },
  reqKind: { id: 'krew.new.req_kind', defaultMessage: 'Kind' },
  reqKindAttendingEvent: {
    id: 'krew.new.req_kind.attending_event',
    defaultMessage: 'Attending an event',
  },
  reqKindLocatedIn: {
    id: 'krew.new.req_kind.located_in',
    defaultMessage: 'Located in a region',
  },
  reqEvent: { id: 'krew.new.req_event', defaultMessage: 'Event' },
  reqRegion: {
    id: 'krew.new.req_region',
    defaultMessage: 'Region (e.g. Melbourne)',
  },
  reqEventMissing: {
    id: 'krew.new.req_event_missing',
    defaultMessage: 'Pick an event, or remove this requirement.',
  },
  reqRegionMissing: {
    id: 'krew.new.req_region_missing',
    defaultMessage: 'Name a region, or remove this requirement.',
  },
  reqIncomplete: {
    id: 'krew.new.req_incomplete',
    defaultMessage: 'Finish or remove the requirements marked above.',
  },
  create: { id: 'krew.new.create', defaultMessage: 'Gather it' },
  creating: { id: 'krew.new.creating', defaultMessage: 'Gathering…' },
});

const slugify = (raw: string): string =>
  raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

const ACCESS_CHOICES: {
  key: KrewAccess;
  label: keyof typeof messages;
  desc: keyof typeof messages;
}[] = [
  { key: 'open', label: 'accessOpen', desc: 'accessOpenDesc' },
  { key: 'approval', label: 'accessApproval', desc: 'accessApprovalDesc' },
  {
    key: 'invite_only',
    label: 'accessInviteOnly',
    desc: 'accessInviteOnlyDesc',
  },
  { key: 'requirement_gated', label: 'accessGated', desc: 'accessGatedDesc' },
];

// The requirement kinds that can be set here, as on Krew settings.
// `vouched_by_member` is provisional (KrewRequirement's docstring): a Krew
// can show one, but nobody sets one from a form of raw JSON.
type SettableReqKind = 'attending_event' | 'located_in';

// Local shape for the requirement rows the user builds up. Serialised
// to KrewRequirementInput on submit.
interface DraftRequirement {
  key: string; // stable react key
  kind: SettableReqKind;
  event_id: string;
  // What the picked event is called and when, for its chip.
  event_title?: string | null;
  event_starts_at?: string | null;
  region: string;
}

const emptyRequirement = (): DraftRequirement => ({
  key: `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  kind: 'located_in',
  event_id: '',
  region: '',
});

// Null when the row isn't filled in yet: submit stops and marks it.
const serialiseRequirement = (
  row: DraftRequirement,
): KrewRequirementInput | null => {
  switch (row.kind) {
    case 'attending_event':
      if (!row.event_id.trim()) return null;
      return { kind: 'attending_event', event_id: row.event_id.trim() };
    case 'located_in':
      if (!row.region.trim()) return null;
      return { kind: 'located_in', region: row.region.trim() };
  }
};

const isSettable = (row: { kind: string }): row is DraftRequirement =>
  row.kind === 'attending_event' || row.kind === 'located_in';

// What a Krew draft keeps (docs/design.md, Drafts). The photo isn't kept:
// it is a file on this device until the Krew exists to put it on.
interface KrewDraftParams {
  name?: string;
  description?: string;
  access?: KrewAccess;
  requirements?: DraftRequirement[];
  invitees?: AccountLite[];
  konnections?: KonnectTarget[];
}

interface Props {
  onCancel: () => void;
  // Fires after a successful create. Parent decides where to navigate
  // — the Krews directory sends the caller to the freshly-gathered
  // Krew's page.
  onCreated: (krew: ApiKrewJSON) => void;
}

export const KrewComposer: React.FC<Props> = ({ onCancel, onCreated }) => {
  const intl = useIntl();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [access, setAccess] = useState<KrewAccess>('open');
  const [requirements, setRequirements] = useState<DraftRequirement[]>([]);
  // Set by a submit that found a requirement not filled in: those rows
  // then say what they're missing.
  const [checkRequirements, setCheckRequirements] = useState(false);
  const [invitees, setInvitees] = useState<AccountLite[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  // What the chosen photo looks like, before there is a Krew to put it on.
  const photoPreview = useMemo(
    () => (photo ? URL.createObjectURL(photo) : null),
    [photo],
  );
  useEffect(
    () => () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    },
    [photoPreview],
  );
  const handlePhoto = useCallback((file: File | null) => {
    if (file) setPhoto(file);
  }, []);
  const handleRemovePhoto = useCallback(() => {
    setPhoto(null);
  }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // What the new Krew will be Konnected to (decisions.md, 2026-10-23).
  const konnect = useKonnect('krew');
  const restoreKonnect = konnect.restore;
  const commitKonnect = konnect.commit;

  // Drafts: what you've written is saved as you go, here and on the
  // server, and comes back when the composer opens again.
  const applyDraft = useCallback(
    (d: ApiComposerDraftJSON<KrewDraftParams> | null) => {
      const p = d?.params ?? {};
      setName(p.name ?? '');
      setDescription(p.description ?? '');
      setAccess(p.access ?? 'open');
      // A draft from before may hold a kind that can't be set here now.
      setRequirements((p.requirements ?? []).filter(isSettable));
      setCheckRequirements(false);
      setInvitees(p.invitees ?? []);
      restoreKonnect(p.konnections);
      setPhoto(null);
      setError(null);
    },
    [restoreKonnect],
  );

  const draft = useDraft<KrewDraftParams>({
    korner: 'krew',
    kind: 'krew',
    snapshot: {
      params: {
        name,
        description,
        access,
        requirements,
        invitees,
        konnections: konnect.saved,
      },
    },
    hasContent:
      name.trim() !== '' ||
      description.trim() !== '' ||
      requirements.length > 0 ||
      invitees.length > 0,
    apply: applyDraft,
    describe: (d) => d.params.name,
    paused: busy,
  });

  const finishDraft = draft.finish;

  const derivedSlug = useMemo(() => slugify(name), [name]);
  const effectiveSlug = derivedSlug;

  const handleNameChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setName(e.target.value);
  }, []);

  const handleDescriptionChange = useCallback<
    React.ChangeEventHandler<HTMLTextAreaElement>
  >((e) => {
    setDescription(e.target.value);
  }, []);

  const handleAccessChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setAccess(e.target.value as KrewAccess);
  }, []);

  const handleAddRequirement = useCallback(() => {
    setRequirements((prev) => [...prev, emptyRequirement()]);
  }, []);

  const updateRequirement = useCallback(
    (key: string, patch: Partial<DraftRequirement>) => {
      setRequirements((prev) =>
        prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
      );
    },
    [],
  );

  const handleRemoveRequirement = useCallback<
    React.MouseEventHandler<HTMLButtonElement>
  >((e) => {
    const { key } = e.currentTarget.dataset;
    if (!key) return;
    setRequirements((prev) => prev.filter((row) => row.key !== key));
  }, []);

  const canSubmit = name.trim().length > 0 && effectiveSlug.length > 0;

  const submit = useCallback(() => {
    setError(null);
    // A requirement row that isn't filled in stops the Krew being made,
    // rather than being left out: a Krew gathered without a requirement
    // its maker meant to set would let in people it shouldn't.
    const serialised: (KrewRequirementInput | null)[] =
      access === 'requirement_gated'
        ? requirements.map(serialiseRequirement)
        : [];
    if (serialised.includes(null)) {
      setCheckRequirements(true);
      return;
    }
    const reqPayload = serialised.filter(
      (r): r is KrewRequirementInput => r !== null,
    );
    setCheckRequirements(false);
    setBusy(true);
    void (async () => {
      try {
        const created = await apiCreateKrew({
          slug: effectiveSlug,
          name: name.trim(),
          description: description.trim() || undefined,
          access,
          requirements: reqPayload.length > 0 ? reqPayload : undefined,
          invite_account_ids:
            invitees.length > 0 ? invitees.map((a) => a.id) : undefined,
        });
        // The photo goes on once the Krew exists. If it will not take, the
        // Krew is still gathered, and its page can try again.
        const withPhoto = photo
          ? await apiSetKrewImage(created.id, photo).catch(() => created)
          : created;
        finishDraft();
        await commitKonnect('krew', created.id);
        onCreated(withPhoto);
        // Note: on success, the parent unmounts us — no need to reset
        // state or clear `busy` here.
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
        setBusy(false);
      }
    })();
  }, [
    invitees,
    access,
    commitKonnect,
    description,
    effectiveSlug,
    finishDraft,
    name,
    onCreated,
    photo,
    requirements,
  ]);

  return (
    <ComposeShell
      korner='krew'
      label={intl.formatMessage(messages.label)}
      subtitle={intl.formatMessage(messages.intro)}
      submitLabel={intl.formatMessage(messages.create)}
      submittingLabel={intl.formatMessage(messages.creating)}
      submitting={busy}
      canSubmit={canSubmit}
      onSubmit={submit}
      onCancel={onCancel}
      draft={draft}
      konnect={konnect}
    >
      <ComposeSection title={intl.formatMessage(messages.identity)}>
        <div className='krew-photo-row'>
          <KrewPhotoField
            name={name}
            imageUrl={photoPreview}
            label={intl.formatMessage(messages.photoChoose)}
            icon={PhotoCameraIcon}
            disabled={busy}
            onPick={handlePhoto}
          />
          <div className='krew-photo-row__text'>
            <span className='krew-photo-row__label'>
              {intl.formatMessage(messages.photo)}
            </span>
            <span>{intl.formatMessage(messages.photoHint)}</span>
            {photo && (
              <button
                type='button'
                className='krew-photo-row__remove'
                onClick={handleRemovePhoto}
              >
                {intl.formatMessage(messages.photoRemove)}
              </button>
            )}
          </div>
        </div>

        <ComposeTitle
          value={name}
          onChange={handleNameChange}
          placeholder={intl.formatMessage(messages.namePlaceholder)}
          aria-label={intl.formatMessage(messages.name)}
          required
        />

        <ComposeBody
          value={description}
          onChange={handleDescriptionChange}
          placeholder={intl.formatMessage(messages.descriptionPlaceholder)}
          aria-label={intl.formatMessage(messages.description)}
          rows={3}
        />
      </ComposeSection>

      <ComposeSection title={intl.formatMessage(messages.people)}>
        <ComposeHint>{intl.formatMessage(messages.peopleHint)}</ComposeHint>
        <AccountMultiSelect value={invitees} onChange={setInvitees} />
      </ComposeSection>

      <ComposeSection title={intl.formatMessage(messages.access)}>
        <div
          className='krew-composer__radios'
          role='radiogroup'
          aria-label={intl.formatMessage(messages.access)}
        >
          {ACCESS_CHOICES.map((choice) => (
            // The input and its words are both inside the label; the rule
            // doesn't follow text through formatMessage.
            // eslint-disable-next-line jsx-a11y/label-has-associated-control
            <label key={choice.key} className='krew-composer__radio'>
              <input
                type='radio'
                name='access'
                value={choice.key}
                checked={access === choice.key}
                onChange={handleAccessChange}
              />
              <span className='krew-composer__radio-text'>
                <span className='krew-composer__radio-label'>
                  {intl.formatMessage(messages[choice.label])}
                </span>
                <span className='krew-composer__radio-desc'>
                  {intl.formatMessage(messages[choice.desc])}
                </span>
              </span>
            </label>
          ))}
        </div>
      </ComposeSection>

      {access === 'requirement_gated' && (
        <ComposeSection title={intl.formatMessage(messages.requirements)}>
          <ComposeHint>
            {intl.formatMessage(messages.requirementsHint)}
          </ComposeHint>
          {requirements.map((row) => (
            <RequirementRow
              key={row.key}
              row={row}
              onChange={updateRequirement}
              onRemove={handleRemoveRequirement}
              showMissing={checkRequirements}
              intl={intl}
            />
          ))}
          <button
            type='button'
            onClick={handleAddRequirement}
            className='krew-composer__add-req'
          >
            {intl.formatMessage(messages.addRequirement)}
          </button>
          {checkRequirements &&
            requirements.some((row) => !serialiseRequirement(row)) && (
              <ComposeHint error>
                {intl.formatMessage(messages.reqIncomplete)}
              </ComposeHint>
            )}
        </ComposeSection>
      )}

      {error && <ComposeHint error>{error}</ComposeHint>}
    </ComposeShell>
  );
};

interface RequirementRowProps {
  row: DraftRequirement;
  onChange: (key: string, patch: Partial<DraftRequirement>) => void;
  onRemove: React.MouseEventHandler<HTMLButtonElement>;
  // Say what the row is missing, if anything (after a submit tried it).
  showMissing: boolean;
  intl: ReturnType<typeof useIntl>;
}

const RequirementRow: React.FC<RequirementRowProps> = ({
  row,
  onChange,
  onRemove,
  showMissing,
  intl,
}) => {
  const missing = showMissing && !serialiseRequirement(row);
  const handleKindChange = useCallback<
    React.ChangeEventHandler<HTMLSelectElement>
  >(
    (e) => {
      onChange(row.key, {
        kind: e.currentTarget.value as DraftRequirement['kind'],
      });
    },
    [onChange, row.key],
  );
  const handleEventChange = useCallback(
    (event: PickedEvent | null) => {
      onChange(row.key, {
        event_id: event?.id ?? '',
        event_title: event?.title ?? null,
        event_starts_at: event?.starts_at ?? null,
      });
    },
    [onChange, row.key],
  );
  const pickedEvent = useMemo<PickedEvent | null>(
    () =>
      row.event_id
        ? {
            id: row.event_id,
            title: row.event_title ?? null,
            starts_at: row.event_starts_at ?? null,
          }
        : null,
    [row.event_id, row.event_title, row.event_starts_at],
  );
  const handleRegionChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >(
    (e) => {
      onChange(row.key, { region: e.currentTarget.value });
    },
    [onChange, row.key],
  );

  return (
    <div className='krew-composer__req-row'>
      <ComposeField label={intl.formatMessage(messages.reqKind)}>
        <ComposeSelect value={row.kind} onChange={handleKindChange}>
          <option value='attending_event'>
            {intl.formatMessage(messages.reqKindAttendingEvent)}
          </option>
          <option value='located_in'>
            {intl.formatMessage(messages.reqKindLocatedIn)}
          </option>
        </ComposeSelect>
      </ComposeField>

      {row.kind === 'attending_event' && (
        // The kit's field look on a <div>, not <ComposeField>: its <label>
        // would hand a click on "Event" to the picker's first control,
        // which is "Change" once an event is picked.
        <div className='compose-field'>
          <span className='compose-field__label'>
            {intl.formatMessage(messages.reqEvent)}
          </span>
          <EventSearch
            value={pickedEvent}
            onChange={handleEventChange}
            label={intl.formatMessage(messages.reqEvent)}
          />
          {missing && (
            <span className='compose-field__error' role='alert'>
              {intl.formatMessage(messages.reqEventMissing)}
            </span>
          )}
        </div>
      )}

      {row.kind === 'located_in' && (
        <ComposeField
          label={intl.formatMessage(messages.reqRegion)}
          error={
            missing ? intl.formatMessage(messages.reqRegionMissing) : undefined
          }
        >
          <ComposeInput value={row.region} onChange={handleRegionChange} />
        </ComposeField>
      )}

      <button
        type='button'
        data-key={row.key}
        onClick={onRemove}
        className='krew-composer__req-remove'
      >
        {intl.formatMessage(messages.removeRow)}
      </button>
    </div>
  );
};
