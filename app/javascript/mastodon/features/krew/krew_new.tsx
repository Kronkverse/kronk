import { useCallback, useMemo, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { useHistory, Link } from 'react-router-dom';

import { apiCreateKrew } from 'mastodon/api/krew';
import type {
  KrewAccess,
  KrewKornerSlug,
  KrewRequirementInput,
} from 'mastodon/api/krew';
import { Stage } from 'mastodon/components/stage';

// Start a Krew (/hub/krew/new) per KRONK_KREWS §7.4. Phase 4c wires
// the Korner multi-select + requirement builder into the create
// payload; the backend picks them up in a single transaction. Invite
// members is deferred until the Nudges routing for it is designed
// (§3 has no approval queue, so the invited-list is a Nudge-send
// rather than a pending-membership row).

const messages = defineMessages({
  title: { id: 'krew.new.title', defaultMessage: 'Start a Krew' },
  back: { id: 'krew.new.back', defaultMessage: '← Cancel' },
  intro: {
    id: 'krew.new.intro',
    defaultMessage:
      'A Krew is a defined group of people you can share with selectively. You seed it — no admin tier, no moderation, no removal power. Members join and leave freely.',
  },
  identity: { id: 'krew.new.identity', defaultMessage: 'Identity' },
  name: { id: 'krew.new.name', defaultMessage: 'Name' },
  namePlaceholder: {
    id: 'krew.new.name_placeholder',
    defaultMessage: 'What are these people?',
  },
  slug: { id: 'krew.new.slug', defaultMessage: 'URL slug' },
  slugHint: {
    id: 'krew.new.slug_hint',
    defaultMessage:
      'Lowercase, hyphens. Auto-generated from the name — edit if you want.',
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
  create: { id: 'krew.new.create', defaultMessage: 'Plant it' },
  creating: { id: 'krew.new.creating', defaultMessage: 'Planting…' },
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
  'kompass',
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

export const KrewNew = () => {
  const intl = useIntl();
  const history = useHistory();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [access, setAccess] = useState<KrewAccess>('open');
  const [korners, setKorners] = useState<KrewKornerSlug[]>([]);
  const [requirements, setRequirements] = useState<DraftRequirement[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const derivedSlug = useMemo(() => slugify(name), [name]);
  const effectiveSlug = slugTouched ? slug : derivedSlug;

  const handleNameChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setName(e.target.value);
  }, []);

  const handleSlugChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setSlug(slugify(e.target.value));
    setSlugTouched(true);
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
    const slug = e.currentTarget.value as KrewKornerSlug;
    setKorners((prev) =>
      e.currentTarget.checked
        ? Array.from(new Set([...prev, slug]))
        : prev.filter((s) => s !== slug),
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

  const canSubmit = name.trim().length > 0 && effectiveSlug.length > 0 && !busy;

  const submit = useCallback(async () => {
    setError(null);
    setBusy(true);
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
      history.push(`/hub/krew/${created.slug}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }, [
    access,
    description,
    effectiveSlug,
    history,
    korners,
    name,
    requirements,
  ]);

  const handleSubmit = useCallback<React.FormEventHandler<HTMLFormElement>>(
    (e) => {
      e.preventDefault();
      void submit();
    },
    [submit],
  );

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <div className='scrollable groups-page'>
        <Link to='/hub/krew' className='group-detail__back'>
          {intl.formatMessage(messages.back)}
        </Link>

        <h1 className='groups-page__form-title'>
          <FormattedMessage {...messages.title} />
        </h1>
        <p className='groups-page__intro'>
          {intl.formatMessage(messages.intro)}
        </p>

        <form onSubmit={handleSubmit} className='groups-page__form'>
          <fieldset>
            <legend>{intl.formatMessage(messages.identity)}</legend>

            <label>
              {intl.formatMessage(messages.name)}
              <input
                type='text'
                value={name}
                onChange={handleNameChange}
                placeholder={intl.formatMessage(messages.namePlaceholder)}
                required
              />
            </label>

            <label>
              {intl.formatMessage(messages.slug)}
              <input
                type='text'
                value={effectiveSlug}
                onChange={handleSlugChange}
                pattern='[a-z][a-z0-9-]*'
              />
              <small>{intl.formatMessage(messages.slugHint)}</small>
            </label>

            <label>
              {intl.formatMessage(messages.description)}
              <textarea
                value={description}
                onChange={handleDescriptionChange}
                placeholder={intl.formatMessage(
                  messages.descriptionPlaceholder,
                )}
                rows={3}
              />
            </label>
          </fieldset>

          <fieldset>
            <legend>{intl.formatMessage(messages.korners)}</legend>
            <p className='groups-page__form-note'>
              {intl.formatMessage(messages.kornersHint)}
            </p>
            <div className='groups-page__form-korners'>
              {KORNER_OPTIONS.map((k) => (
                <label
                  key={k}
                  className={`groups-page__korner-checkbox ${korners.includes(k) ? 'groups-page__korner-checkbox--active' : ''}`}
                >
                  <input
                    type='checkbox'
                    value={k}
                    checked={korners.includes(k)}
                    onChange={handleKornerToggle}
                  />
                  {k}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>{intl.formatMessage(messages.access)}</legend>

            <label className='groups-page__form-radio'>
              <input
                type='radio'
                name='access'
                value='open'
                checked={access === 'open'}
                onChange={handleAccessChange}
              />
              {intl.formatMessage(messages.accessOpen)}
            </label>

            <label className='groups-page__form-radio'>
              <input
                type='radio'
                name='access'
                value='invite_only'
                checked={access === 'invite_only'}
                onChange={handleAccessChange}
              />
              {intl.formatMessage(messages.accessInviteOnly)}
            </label>

            <label className='groups-page__form-radio'>
              <input
                type='radio'
                name='access'
                value='requirement_gated'
                checked={access === 'requirement_gated'}
                onChange={handleAccessChange}
              />
              {intl.formatMessage(messages.accessGated)}
            </label>
          </fieldset>

          {access === 'requirement_gated' && (
            <fieldset>
              <legend>{intl.formatMessage(messages.requirements)}</legend>
              <p className='groups-page__form-note'>
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
                className='groups-page__form-add'
              >
                {intl.formatMessage(messages.addRequirement)}
              </button>
            </fieldset>
          )}

          {error && <p className='groups-page__error'>{error}</p>}

          <button
            type='submit'
            disabled={!canSubmit}
            className='groups-page__form-submit'
          >
            {busy
              ? intl.formatMessage(messages.creating)
              : intl.formatMessage(messages.create)}
          </button>
        </form>
      </div>
    </Stage>
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
    <div className='groups-page__form-req-row'>
      <label>
        {intl.formatMessage(messages.reqKind)}
        <select value={row.kind} onChange={handleKindChange}>
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
        <label>
          {intl.formatMessage(messages.reqEventId)}
          <input
            type='text'
            data-field='event_id'
            value={row.event_id}
            onChange={handleFieldChange}
          />
        </label>
      )}

      {row.kind === 'located_in' && (
        <label>
          {intl.formatMessage(messages.reqRegion)}
          <input
            type='text'
            data-field='region'
            value={row.region}
            onChange={handleFieldChange}
          />
        </label>
      )}

      {row.kind === 'vouched_by_member' && (
        <label>
          {intl.formatMessage(messages.reqVouchParams)}
          <textarea
            data-field='vouch_params'
            value={row.vouch_params}
            onChange={handleFieldChange}
            rows={2}
            placeholder='{"min": 1}'
          />
        </label>
      )}

      <button
        type='button'
        data-key={row.key}
        onClick={onRemove}
        className='groups-page__form-req-remove'
      >
        {intl.formatMessage(messages.removeRow)}
      </button>
    </div>
  );
};
