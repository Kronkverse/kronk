import { useCallback, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiCreateKrew } from 'mastodon/api/krew';
import type {
  ApiKrewJSON,
  KrewAccess,
  KrewKornerSlug,
  KrewRequirementInput,
} from 'mastodon/api/krew';
import { ComposeShell } from 'mastodon/components/compose_shell';

// Start a Krew (/hub/krew/composer) — the standard `<ComposeShell>`
// overlay mounted on top of the Krews directory. Was the full-page
// `KrewNew` at /hub/krew/new until 2026-08-12; /hub/krew/new is now
// a legacy alias resolving to the same overlay (see the ui/index.jsx
// routes + docs/rebuild/decisions.md 2026-08-12 entry).
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
    defaultMessage:
      'Attach the spaces this Krew will use. Attaching a Korner turns it on for the Krew — you can add or remove more later.',
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
  reqEventId: { id: 'krew.new.req_event_id', defaultMessage: 'Event ID' },
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

// KrewKorner::KORNERS mirrored here so the checkboxes stay in a fixed
// order. New korners land in both places at once.
const KORNER_OPTIONS: KrewKornerSlug[] = [
  'booth',
  'huddle',
  'kalendar',
  'kommons',
  'map',
  'albutts',
  'kuestions',
];

// Local shape for the requirement rows the user builds up. Serialised
// to KrewRequirementInput on submit; unknown fields dropped.
interface DraftRequirement {
  key: string; // stable react key
  kind: KrewRequirementInput['kind'];
  event_id: string;
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const kornerSlug = e.currentTarget.value as KrewKornerSlug;
    setKorners((prev) =>
      e.currentTarget.checked
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
        });
        onCreated(created);
        // Note: on success, the parent unmounts us — no need to reset
        // state or clear `busy` here.
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
        setBusy(false);
      }
    })();
  }, [
    access,
    description,
    effectiveSlug,
    korners,
    name,
    onCreated,
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
    >
      <div className='krew-composer'>
        <fieldset className='krew-composer__fieldset'>
          <legend className='krew-composer__legend'>
            {intl.formatMessage(messages.identity)}
          </legend>

          <label className='krew-composer__field'>
            <span className='krew-composer__field-label'>
              {intl.formatMessage(messages.name)}
            </span>
            <input
              type='text'
              value={name}
              onChange={handleNameChange}
              placeholder={intl.formatMessage(messages.namePlaceholder)}
              required
              className='krew-composer__input'
            />
          </label>

          <label className='krew-composer__field'>
            <span className='krew-composer__field-label'>
              {intl.formatMessage(messages.description)}
            </span>
            <textarea
              value={description}
              onChange={handleDescriptionChange}
              placeholder={intl.formatMessage(messages.descriptionPlaceholder)}
              rows={3}
              className='krew-composer__input'
            />
          </label>
        </fieldset>

        <fieldset className='krew-composer__fieldset'>
          <legend className='krew-composer__legend'>
            {intl.formatMessage(messages.korners)}
          </legend>
          <p className='krew-composer__note'>
            {intl.formatMessage(messages.kornersHint)}
          </p>
          <div className='krew-composer__korner-grid'>
            {KORNER_OPTIONS.map((k) => (
              <label
                key={k}
                className={`krew-composer__korner-chip ${korners.includes(k) ? 'krew-composer__korner-chip--active' : ''}`}
              >
                <input
                  type='checkbox'
                  value={k}
                  checked={korners.includes(k)}
                  onChange={handleKornerToggle}
                  className='krew-composer__korner-chip-input'
                />
                <span className='krew-composer__korner-chip-name'>{k}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className='krew-composer__fieldset'>
          <legend className='krew-composer__legend'>
            {intl.formatMessage(messages.access)}
          </legend>

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
        </fieldset>

        {access === 'requirement_gated' && (
          <fieldset className='krew-composer__fieldset'>
            <legend className='krew-composer__legend'>
              {intl.formatMessage(messages.requirements)}
            </legend>
            <p className='krew-composer__note'>
              {intl.formatMessage(messages.requirementsHint)}
            </p>
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
          </fieldset>
        )}

        {error && <p className='krew-composer__error'>{error}</p>}
      </div>
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
  const handleFieldChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>
  >(
    (e) => {
      const field = e.currentTarget.dataset.field as
        | 'event_id'
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
      <label className='krew-composer__field'>
        <span className='krew-composer__field-label'>
          {intl.formatMessage(messages.reqKind)}
        </span>
        <select
          value={row.kind}
          onChange={handleKindChange}
          className='krew-composer__input'
        >
          <option value='attending_event'>
            {intl.formatMessage(messages.reqKindAttendingEvent)}
          </option>
          <option value='located_in'>
            {intl.formatMessage(messages.reqKindLocatedIn)}
          </option>
          <option value='vouched_by_member'>
            {intl.formatMessage(messages.reqKindVouched)}
          </option>
        </select>
      </label>

      {row.kind === 'attending_event' && (
        <label className='krew-composer__field'>
          <span className='krew-composer__field-label'>
            {intl.formatMessage(messages.reqEventId)}
          </span>
          <input
            type='text'
            data-field='event_id'
            value={row.event_id}
            onChange={handleFieldChange}
            className='krew-composer__input'
          />
        </label>
      )}

      {row.kind === 'located_in' && (
        <label className='krew-composer__field'>
          <span className='krew-composer__field-label'>
            {intl.formatMessage(messages.reqRegion)}
          </span>
          <input
            type='text'
            data-field='region'
            value={row.region}
            onChange={handleFieldChange}
            className='krew-composer__input'
          />
        </label>
      )}

      {row.kind === 'vouched_by_member' && (
        <label className='krew-composer__field'>
          <span className='krew-composer__field-label'>
            {intl.formatMessage(messages.reqVouchParams)}
          </span>
          <textarea
            data-field='vouch_params'
            value={row.vouch_params}
            onChange={handleFieldChange}
            rows={2}
            placeholder='{"min": 1}'
            className='krew-composer__input'
          />
        </label>
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
