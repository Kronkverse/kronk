import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import PhotoCameraIcon from '@/material-icons/400-24px/photo_camera.svg?react';
import {
  apiCreateKrew,
  apiSetKrewImage,
  KREW_PAGE_SPACES,
} from 'mastodon/api/krew';
import type {
  ApiKrewJSON,
  KrewAccess,
  KrewKornerSlug,
  KrewRequirementInput,
} from 'mastodon/api/krew';
import type { ApiComposerDraftJSON } from 'mastodon/api_types/drafts';
import { AccountMultiSelect } from 'mastodon/components/account_multi_select';
import type { AccountLite } from 'mastodon/components/account_multi_select';
import {
  ComposeBody,
  ComposeCheck,
  ComposeField,
  ComposeHint,
  ComposeInput,
  ComposeSection,
  ComposeSelect,
  ComposeTextarea,
  ComposeTitle,
} from 'mastodon/components/compose_fields';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { EventSearch } from 'mastodon/components/event_search';
import type { PickedEvent } from 'mastodon/components/event_search';
import { useDraft } from 'mastodon/hooks/useDraft';
import type { KonnectTarget } from 'mastodon/hooks/useKonnect';
import { useKonnect } from 'mastodon/hooks/useKonnect';

import { KrewPhotoField } from './krew_photo_field';
import { KrewSpaceIcon } from './krew_space_icon';

// Start a Krew (/hub/krew/composer) — the standard `<ComposeShell>`
// overlay mounted on top of the Krews directory. Was the full-page
// `KrewNew` at /hub/krew/new until 2026-08-12; /hub/krew/new is now
// a legacy alias resolving to the same overlay (see the ui/index.jsx
// routes + docs/decisions.md 2026-08-12 entry).
//
// Phase 4c wires the Korner multi-select + requirement builder into
// the create payload; the backend picks them up in a single
// transaction. Invite members is deferred until the Nudges routing
// for it is designed (§3 has no approval queue, so the invited-list
// is a Nudge-send rather than a pending-membership row).

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
  accessOpen: {
    id: 'krew.new.access_open',
    defaultMessage: 'Open — anyone can find and join',
  },
  accessApproval: {
    id: 'krew.new.access_approval',
    defaultMessage: 'Ask to join — anyone can find it; a member lets them in',
  },
  accessInviteOnly: {
    id: 'krew.new.access_invite',
    defaultMessage: 'Invite-only — hidden; join by invite link only',
  },
  accessGated: {
    id: 'krew.new.access_gated',
    defaultMessage: 'Requirement-gated — findable, but join is gated',
  },
  korners: { id: 'krew.new.korners', defaultMessage: 'Korners' },
  kornersHint: {
    id: 'krew.new.korners_hint',
    defaultMessage: 'What functionality will this {name} need?',
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
    defaultMessage:
      'Applicants must satisfy every requirement. Add rows below; each rule is ANDed.',
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
  reqKindVouched: {
    id: 'krew.new.req_kind.vouched_by_member',
    defaultMessage: 'Vouched by a member',
  },
  reqEvent: { id: 'krew.new.req_event', defaultMessage: 'Event' },
  reqRegion: {
    id: 'krew.new.req_region',
    defaultMessage: 'Region (e.g. Melbourne)',
  },
  reqVouchParams: {
    id: 'krew.new.req_vouch_params',
    defaultMessage: 'Vouch parameters (JSON, provisional)',
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

// Only the spaces that can show a Krew's own things on its page
// (KREW_PAGE_SPACES, decisions.md 2026-10-18).
const KORNER_OPTIONS: KrewKornerSlug[] = KREW_PAGE_SPACES;

// Local shape for the requirement rows the user builds up. Serialised
// to KrewRequirementInput on submit; unknown fields dropped.
interface DraftRequirement {
  key: string; // stable react key
  kind: KrewRequirementInput['kind'];
  event_id: string;
  // What the picked event is called and when, for its chip.
  event_title?: string | null;
  event_starts_at?: string | null;
  region: string;
  vouch_params: string;
}

const emptyRequirement = (): DraftRequirement => ({
  key: `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  kind: 'located_in',
  event_id: '',
  region: '',
  vouch_params: '',
});

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
    case 'vouched_by_member': {
      if (!row.vouch_params.trim()) return null;
      try {
        const parsed = JSON.parse(row.vouch_params) as Record<string, unknown>;
        return { kind: 'vouched_by_member', vouch_params: parsed };
      } catch {
        return null;
      }
    }
  }
};

// What a Krew draft keeps (docs/design.md, Drafts). The photo isn't kept:
// it is a file on this device until the Krew exists to put it on.
interface KrewDraftParams {
  name?: string;
  description?: string;
  access?: KrewAccess;
  korners?: KrewKornerSlug[];
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
  const [korners, setKorners] = useState<KrewKornerSlug[]>([]);
  const [requirements, setRequirements] = useState<DraftRequirement[]>([]);
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
      setKorners(p.korners ?? []);
      setRequirements(p.requirements ?? []);
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
        korners,
        requirements,
        invitees,
        konnections: konnect.saved,
      },
    },
    hasContent:
      name.trim() !== '' ||
      description.trim() !== '' ||
      korners.length > 0 ||
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

  const handleKornerToggle = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    // Read both off currentTarget *before* the setState updater — React nulls
    // event.currentTarget after the handler returns, and the updater runs
    // later, so reading e.currentTarget.checked inside it crashed on every
    // korner toggle (TypeError: reading 'checked' of null).
    const kornerSlug = e.currentTarget.value as KrewKornerSlug;
    const { checked } = e.currentTarget;
    setKorners((prev) =>
      checked
        ? Array.from(new Set([...prev, kornerSlug]))
        : prev.filter((s) => s !== kornerSlug),
    );
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
    setBusy(true);
    void (async () => {
      try {
        const reqPayload =
          access === 'requirement_gated'
            ? requirements
                .map(serialiseRequirement)
                .filter((r): r is KrewRequirementInput => r !== null)
            : undefined;

        const created = await apiCreateKrew({
          slug: effectiveSlug,
          name: name.trim(),
          description: description.trim() || undefined,
          access,
          korner_attachments: korners.length > 0 ? korners : undefined,
          requirements:
            reqPayload && reqPayload.length > 0 ? reqPayload : undefined,
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
    korners,
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

      <ComposeSection title={intl.formatMessage(messages.korners)}>
        <ComposeHint>
          {intl.formatMessage(messages.kornersHint, {
            name: name.trim() || 'Krew',
          })}
        </ComposeHint>
        <div className='krew-composer__korner-grid'>
          {KORNER_OPTIONS.map((k) => (
            <ComposeCheck
              key={k}
              className={`krew-composer__korner-tile ${korners.includes(k) ? 'krew-composer__korner-tile--active' : ''}`}
              value={k}
              checked={korners.includes(k)}
              onChange={handleKornerToggle}
              label={
                <>
                  <KrewSpaceIcon
                    slug={k}
                    className='krew-composer__korner-tile-glyph'
                  />
                  <span className='krew-composer__korner-tile-name'>{k}</span>
                </>
              }
            />
          ))}
        </div>
      </ComposeSection>

      <ComposeSection title={intl.formatMessage(messages.access)}>
        <label className='krew-composer__radio'>
          <input
            type='radio'
            name='access'
            value='open'
            checked={access === 'open'}
            onChange={handleAccessChange}
          />
          <span>{intl.formatMessage(messages.accessOpen)}</span>
        </label>

        <label className='krew-composer__radio'>
          <input
            type='radio'
            name='access'
            value='approval'
            checked={access === 'approval'}
            onChange={handleAccessChange}
          />
          <span>{intl.formatMessage(messages.accessApproval)}</span>
        </label>

        <label className='krew-composer__radio'>
          <input
            type='radio'
            name='access'
            value='invite_only'
            checked={access === 'invite_only'}
            onChange={handleAccessChange}
          />
          <span>{intl.formatMessage(messages.accessInviteOnly)}</span>
        </label>

        <label className='krew-composer__radio'>
          <input
            type='radio'
            name='access'
            value='requirement_gated'
            checked={access === 'requirement_gated'}
            onChange={handleAccessChange}
          />
          <span>{intl.formatMessage(messages.accessGated)}</span>
        </label>
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
  intl: ReturnType<typeof useIntl>;
}

const RequirementRow: React.FC<RequirementRowProps> = ({
  row,
  onChange,
  onRemove,
  intl,
}) => {
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
  const handleFieldChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>
  >(
    (e) => {
      const field = e.currentTarget.dataset.field as
        | 'region'
        | 'vouch_params'
        | undefined;
      if (!field) return;
      onChange(row.key, { [field]: e.currentTarget.value });
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
          <option value='vouched_by_member'>
            {intl.formatMessage(messages.reqKindVouched)}
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
        </div>
      )}

      {row.kind === 'located_in' && (
        <ComposeField label={intl.formatMessage(messages.reqRegion)}>
          <ComposeInput
            data-field='region'
            value={row.region}
            onChange={handleFieldChange}
          />
        </ComposeField>
      )}

      {row.kind === 'vouched_by_member' && (
        <ComposeField label={intl.formatMessage(messages.reqVouchParams)}>
          <ComposeTextarea
            data-field='vouch_params'
            value={row.vouch_params}
            onChange={handleFieldChange}
            rows={2}
            placeholder='{"min": 1}'
          />
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
