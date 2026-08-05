// Kronk Scope Picker — the standard "who's this for / who can
// add?" conversation, shared across every korner that scopes
// visibility + contribution. See docs/kronk_scope_picker.md.
//
// Controlled component. Parent owns state (visibility, contribution,
// krewIds, invitedIds, eventId) and passes callbacks. Picker
// renders the two-question chip UI + inline sub-pickers when
// needed. Constraint logic (auto-mirror Krews, suppress `open`
// when `self_only`) is enforced here so each korner doesn't
// re-derive it.
//
// First user: Albutts (2026-08-05). Other korners adopt as their
// composers migrate.

import { useCallback, useMemo } from 'react';

import { FormattedMessage } from 'react-intl';

import { KornerKrewPicker } from './korner_krew_picker';

// ────────────────────────────────────────────────────────────────
// Vocabulary (matches docs/kronk_scope_picker.md).
// ────────────────────────────────────────────────────────────────

export type VisibilityScope =
  | 'public'
  | 'mates'
  | 'orbit'
  | 'krew'
  | 'self_only';

export type ContributionRoster =
  | 'open'
  | 'closed'
  | 'invited'
  | 'krew'
  | 'event';

// Chip metadata: label + short helper text (rendered as `title` on
// the chip for tooltip discoverability). Kept as data (not JSX) so
// the same records serve programmatic consumers (server-side
// validation error messages, for example) if they get exported later.
interface ChipMeta {
  label: React.ReactNode;
  title: string;
}

const VISIBILITY_META: Record<VisibilityScope, ChipMeta> = {
  self_only: {
    label: (
      <FormattedMessage
        id='scope_picker.visibility.self_only'
        defaultMessage='Just me'
      />
    ),
    title: 'Only you can see this.',
  },
  mates: {
    label: (
      <FormattedMessage
        id='scope_picker.visibility.mates'
        defaultMessage='My mates'
      />
    ),
    title: 'People who mate you back.',
  },
  orbit: {
    label: (
      <FormattedMessage
        id='scope_picker.visibility.orbit'
        defaultMessage='My orbit'
      />
    ),
    title: 'Your mates + their mates (one hop out).',
  },
  krew: {
    label: (
      <FormattedMessage
        id='scope_picker.visibility.krew'
        defaultMessage='A specific Krew'
      />
    ),
    title: 'Members of the Krews you pick below.',
  },
  public: {
    label: (
      <FormattedMessage
        id='scope_picker.visibility.public'
        defaultMessage='Everyone on Kronk'
      />
    ),
    title: 'Any signed-in Kronk member.',
  },
};

const CONTRIBUTION_META: Record<ContributionRoster, ChipMeta> = {
  open: {
    label: (
      <FormattedMessage
        id='scope_picker.contribution.open'
        defaultMessage='Anyone who can see it'
      />
    ),
    title: 'Whoever can view this can also add to it.',
  },
  closed: {
    label: (
      <FormattedMessage
        id='scope_picker.contribution.closed'
        defaultMessage='Only me'
      />
    ),
    title: 'You are the sole contributor.',
  },
  invited: {
    label: (
      <FormattedMessage
        id='scope_picker.contribution.invited'
        defaultMessage='People I add'
      />
    ),
    title: 'A specific set of accounts you nominate.',
  },
  krew: {
    label: (
      <FormattedMessage
        id='scope_picker.contribution.krew'
        defaultMessage='A specific Krew'
      />
    ),
    title: 'Members of the Krews you pick below.',
  },
  event: {
    label: (
      <FormattedMessage
        id='scope_picker.contribution.event'
        defaultMessage='Anyone at an event'
      />
    ),
    title: "Everyone who RSVP'd to the event you pick below.",
  },
};

// ────────────────────────────────────────────────────────────────
// Props.
// ────────────────────────────────────────────────────────────────

// Which sub-picker payload changed alongside the axis change.
// Callbacks receive it so korners can persist krewIds / invitedIds
// / eventId atomically with the axis flip.
export interface ScopePickerMeta {
  krewIds?: string[];
  invitedIds?: string[];
  eventId?: string | null;
}

export interface ScopePickerProps {
  // Which options this korner supports. Declaration-order becomes
  // render order in the chip row.
  visibilityOptions: readonly VisibilityScope[];
  contributionOptions: readonly ContributionRoster[];

  // Current state (controlled).
  visibility: VisibilityScope;
  contribution: ContributionRoster;
  krewIds?: string[];
  invitedIds?: string[];
  eventId?: string | null;

  // State updates.
  onVisibilityChange: (v: VisibilityScope, meta?: ScopePickerMeta) => void;
  onContributionChange: (c: ContributionRoster, meta?: ScopePickerMeta) => void;

  // Optional per-korner label overrides (e.g. Kommons might say
  // "Who can back it?" instead of "Who can add to it?").
  visibilityQuestion?: React.ReactNode;
  contributionQuestion?: React.ReactNode;

  disabled?: boolean;
  className?: string;
}

// ────────────────────────────────────────────────────────────────
// Chip row primitive.
// ────────────────────────────────────────────────────────────────

interface ChipRowProps<T extends string> {
  options: readonly T[];
  meta: Record<T, ChipMeta>;
  value: T;
  onSelect: (v: T) => void;
  disabledSet?: ReadonlySet<T>;
  disabled?: boolean;
}

interface ChipButtonProps<T extends string> {
  option: T;
  isSelected: boolean;
  isDisabled: boolean;
  label: React.ReactNode;
  title: string;
  onSelect: (v: T) => void;
}

// Per-chip component so `onClick` is a stable callback rather than
// an inline arrow inside the map (react/jsx-no-bind).
const ChipButton = <T extends string>({
  option,
  isSelected,
  isDisabled,
  label,
  title,
  onSelect,
}: ChipButtonProps<T>) => {
  const handleClick = useCallback(() => {
    onSelect(option);
  }, [onSelect, option]);
  return (
    <button
      type='button'
      role='radio'
      aria-checked={isSelected}
      className={`scope-picker__chip${isSelected ? ' scope-picker__chip--selected' : ''}`}
      title={title}
      disabled={isDisabled}
      onClick={handleClick}
    >
      {label}
    </button>
  );
};

const ChipRow = <T extends string>({
  options,
  meta,
  value,
  onSelect,
  disabledSet,
  disabled,
}: ChipRowProps<T>) => (
  <div className='scope-picker__chips' role='radiogroup'>
    {options.map((opt) => (
      <ChipButton
        key={opt}
        option={opt}
        isSelected={opt === value}
        isDisabled={Boolean(disabled) || Boolean(disabledSet?.has(opt))}
        label={meta[opt].label}
        title={meta[opt].title}
        onSelect={onSelect}
      />
    ))}
  </div>
);

// ────────────────────────────────────────────────────────────────
// The picker.
// ────────────────────────────────────────────────────────────────

export const ScopePicker: React.FC<ScopePickerProps> = ({
  visibilityOptions,
  contributionOptions,
  visibility,
  contribution,
  krewIds,
  invitedIds,
  eventId,
  onVisibilityChange,
  onContributionChange,
  visibilityQuestion,
  contributionQuestion,
  disabled,
  className,
}) => {
  // ── Constraint: contribution `open` doesn't make sense with
  // ── visibility `self_only` (nobody besides the owner sees it,
  // ── so 'anyone who can see it' collapses to just the owner —
  // ── which is `closed`). Suppress `open` in that state.
  const contributionDisabled = useMemo<ReadonlySet<ContributionRoster>>(() => {
    const set = new Set<ContributionRoster>();
    if (visibility === 'self_only') set.add('open');
    return set;
  }, [visibility]);

  // Krew sub-picker — SHARED between visibility and contribution
  // per the auto-mirror decision. Single-select for now (matches
  // KornerKrewPicker); the array form is preserved because the
  // backend already stores album_krews as a many-to-many and
  // multi-select is likely in a later iteration.
  const activeKrewId = krewIds && krewIds.length > 0 ? krewIds[0] : null;
  const handleKrewChange = useCallback(
    (nextKrewId: string) => {
      const meta: ScopePickerMeta = { krewIds: [nextKrewId] };
      // Fire on whichever axis is currently `krew` — usually both
      // when auto-mirrored. If only one is `krew`, fire that one.
      if (visibility === 'krew') onVisibilityChange('krew', meta);
      if (contribution === 'krew') onContributionChange('krew', meta);
    },
    [visibility, contribution, onVisibilityChange, onContributionChange],
  );

  // Visibility change handler — auto-mirror Krew: if the user
  // picks `krew` for visibility while contribution is already
  // `krew`, share the same Krew list (contribution krew
  // auto-follows visibility krew).
  const handleVisibilityChange = useCallback(
    (next: VisibilityScope) => {
      if (next === visibility) return;
      const meta: ScopePickerMeta = { krewIds };
      onVisibilityChange(next, meta);
      // If flipping AWAY from `krew`, and contribution is `krew`,
      // contribution's Krew list still holds — but the shared
      // picker is only rendered when at least one axis needs it,
      // so the row stays visible via contribution.
    },
    [visibility, krewIds, onVisibilityChange],
  );

  const handleContributionChange = useCallback(
    (next: ContributionRoster) => {
      if (next === contribution) return;
      const meta: ScopePickerMeta = { krewIds, invitedIds, eventId };
      onContributionChange(next, meta);
    },
    [contribution, krewIds, invitedIds, eventId, onContributionChange],
  );

  const showKrewSubpicker = visibility === 'krew' || contribution === 'krew';

  const rootClass = `scope-picker ${className ?? ''}`.trim();

  return (
    <fieldset className={rootClass} disabled={disabled}>
      <div className='scope-picker__question'>
        <legend className='scope-picker__legend'>
          {visibilityQuestion ?? (
            <FormattedMessage
              id='scope_picker.question.visibility'
              defaultMessage="Who's this for?"
            />
          )}
        </legend>
        <ChipRow
          options={visibilityOptions}
          meta={VISIBILITY_META}
          value={visibility}
          onSelect={handleVisibilityChange}
          disabled={disabled}
        />
      </div>

      <div className='scope-picker__question'>
        <legend className='scope-picker__legend'>
          {contributionQuestion ?? (
            <FormattedMessage
              id='scope_picker.question.contribution'
              defaultMessage='Who can add to it?'
            />
          )}
        </legend>
        <ChipRow
          options={contributionOptions}
          meta={CONTRIBUTION_META}
          value={contribution}
          onSelect={handleContributionChange}
          disabledSet={contributionDisabled}
          disabled={disabled}
        />
      </div>

      {/* Shared Krew sub-picker — one instance drives both axes
         when they mirror. Renders below both questions rather
         than under a specific chip so the auto-mirror is
         visually obvious ("this Krew applies to both"). */}
      {showKrewSubpicker && (
        <div className='scope-picker__subpicker scope-picker__subpicker--krew'>
          <div className='scope-picker__subpicker-label'>
            <FormattedMessage
              id='scope_picker.krew.label'
              defaultMessage='Which Krew?'
            />
          </div>
          <KornerKrewPicker
            value={activeKrewId}
            onChange={handleKrewChange}
            disabled={disabled}
          />
        </div>
      )}

      {/* Invited-list and event sub-pickers are declared in the
         vocabulary but not yet implemented — they need supporting
         infrastructure (account autocomplete, Kalendar event
         picker + attendee query) that lands in follow-up PRs.
         Until then, korners can render them as disabled chips or
         omit from contributionOptions entirely. */}
      {contribution === 'invited' && (
        <div className='scope-picker__subpicker scope-picker__subpicker--invited'>
          <FormattedMessage
            id='scope_picker.invited.placeholder'
            defaultMessage='Invited-list picker is not built yet — you have {n} account(s) selected.'
            values={{ n: invitedIds?.length ?? 0 }}
          />
        </div>
      )}
      {contribution === 'event' && (
        <div className='scope-picker__subpicker scope-picker__subpicker--event'>
          <FormattedMessage
            id='scope_picker.event.placeholder'
            defaultMessage='Event picker is not built yet — selected event: {id}'
            values={{ id: eventId ?? '—' }}
          />
        </div>
      )}
    </fieldset>
  );
};
