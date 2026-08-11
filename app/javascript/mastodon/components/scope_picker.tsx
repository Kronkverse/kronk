// Kronk Scope Picker — the standard "who's this for / who can add?"
// conversation, shared across every korner that scopes visibility +
// contribution. See docs/kronk_scope_picker.md and
// docs/rebuild/krew_axis_migration.md.
//
// Both axes are ADDITIVE (2026-08-11):
//   * Audience    = a reach tier (self_only/mates/orbit/public) + any krews.
//   * Contribution= a base (anyone who can see it, OR a restricted roster)
//                   + a roster that is the union of specific people and krews.
//
// Controlled component. The parent owns all state and passes callbacks; this
// renders the two-question UI + the additive sub-pickers.

import { useCallback, useMemo } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { useAvailableKrews } from '../hooks/useAvailableKrews';

import type { AccountLite } from './account_multi_select';
import { AccountMultiSelect } from './account_multi_select';
import { KrewMultiSelect } from './krew_multi_select';
import type { KrewOption } from './reach_dropdown';

// ────────────────────────────────────────────────────────────────
// Vocabulary (matches docs/kronk_scope_picker.md). `krew` stays in the
// union for back-compat but is no longer offered as a reach tier — it's the
// additive krew axis below.
// ────────────────────────────────────────────────────────────────

export type VisibilityScope =
  | 'public'
  | 'mates'
  | 'orbit'
  | 'krew'
  | 'self_only';

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
        defaultMessage='Kronkverse'
      />
    ),
    title: 'Any signed-in Kronk member.',
  },
};

const messages = defineMessages({
  audienceKrews: {
    id: 'scope_picker.audience_krews',
    defaultMessage: 'Also visible to krews',
  },
  noKrews: {
    id: 'scope_picker.no_krews',
    defaultMessage: 'You’re not in any krews yet.',
  },
  contributionOpen: {
    id: 'scope_picker.contribution.open',
    defaultMessage: 'Anyone who can see it',
  },
  contributionRestricted: {
    id: 'scope_picker.contribution.restricted',
    defaultMessage: 'Only people I choose',
  },
  contributorKrews: {
    id: 'scope_picker.contributor_krews',
    defaultMessage: 'Krews who can add',
  },
  contributorPeople: {
    id: 'scope_picker.contributor_people',
    defaultMessage: 'People who can add',
  },
  selfOnlyNote: {
    id: 'scope_picker.self_only_note',
    defaultMessage: 'Only you can add to a just-me album.',
  },
});

// ────────────────────────────────────────────────────────────────
// Props.
// ────────────────────────────────────────────────────────────────

export interface ScopePickerProps {
  // Reach tiers this korner offers (declaration order = render order).
  visibilityOptions: readonly VisibilityScope[];
  visibility: VisibilityScope;
  onVisibilityChange: (v: VisibilityScope) => void;

  // Additive audience krews.
  audienceKrewIds: readonly string[];
  onToggleAudienceKrew: (id: string) => void;

  // Contribution: open (anyone who can see it) vs a restricted roster.
  contributionOpen: boolean;
  onContributionOpenChange: (open: boolean) => void;

  // Restricted-roster members (additive: krews ∪ people).
  contributorKrewIds: readonly string[];
  onToggleContributorKrew: (id: string) => void;
  contributorAccounts: AccountLite[];
  onContributorAccountsChange: (next: AccountLite[]) => void;

  visibilityQuestion?: React.ReactNode;
  contributionQuestion?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

// ────────────────────────────────────────────────────────────────
// Chip row primitive.
// ────────────────────────────────────────────────────────────────

interface ChipButtonProps {
  isSelected: boolean;
  isDisabled: boolean;
  label: React.ReactNode;
  title?: string;
  onSelect: () => void;
}

const ChipButton: React.FC<ChipButtonProps> = ({
  isSelected,
  isDisabled,
  label,
  title,
  onSelect,
}) => (
  <button
    type='button'
    role='radio'
    aria-checked={isSelected}
    className={`scope-picker__chip${isSelected ? ' scope-picker__chip--selected' : ''}`}
    title={title}
    disabled={isDisabled}
    onClick={onSelect}
  >
    {label}
  </button>
);

const VisibilityChip: React.FC<{
  option: VisibilityScope;
  selected: boolean;
  disabled: boolean;
  onSelect: (v: VisibilityScope) => void;
}> = ({ option, selected, disabled, onSelect }) => {
  const handle = useCallback(() => {
    onSelect(option);
  }, [onSelect, option]);
  return (
    <ChipButton
      isSelected={selected}
      isDisabled={disabled}
      label={VISIBILITY_META[option].label}
      title={VISIBILITY_META[option].title}
      onSelect={handle}
    />
  );
};

// ────────────────────────────────────────────────────────────────
// The picker.
// ────────────────────────────────────────────────────────────────

export const ScopePicker: React.FC<ScopePickerProps> = ({
  visibilityOptions,
  visibility,
  onVisibilityChange,
  audienceKrewIds,
  onToggleAudienceKrew,
  contributionOpen,
  onContributionOpenChange,
  contributorKrewIds,
  onToggleContributorKrew,
  contributorAccounts,
  onContributorAccountsChange,
  visibilityQuestion,
  contributionQuestion,
  disabled = false,
  className,
}) => {
  const intl = useIntl();
  const krews: readonly KrewOption[] = useAvailableKrews();

  const audienceIsSelfOnly = visibility === 'self_only';

  const handleOpen = useCallback(() => {
    onContributionOpenChange(true);
  }, [onContributionOpenChange]);
  const handleRestricted = useCallback(() => {
    onContributionOpenChange(false);
  }, [onContributionOpenChange]);

  const rootClass = `scope-picker ${className ?? ''}`.trim();

  const krewsEmptyLabel = useMemo(
    () => intl.formatMessage(messages.noKrews),
    [intl],
  );

  return (
    <fieldset className={rootClass} disabled={disabled}>
      {/* ── Audience ─────────────────────────────────────────── */}
      <div className='scope-picker__question'>
        <legend className='scope-picker__legend'>
          {visibilityQuestion ?? (
            <FormattedMessage
              id='scope_picker.question.visibility'
              defaultMessage="Who's this for?"
            />
          )}
        </legend>
        <div className='scope-picker__chips' role='radiogroup'>
          {visibilityOptions.map((opt) => (
            <VisibilityChip
              key={opt}
              option={opt}
              selected={opt === visibility}
              disabled={disabled}
              onSelect={onVisibilityChange}
            />
          ))}
        </div>

        <div className='scope-picker__subpicker'>
          <div className='scope-picker__subpicker-label'>
            {intl.formatMessage(messages.audienceKrews)}
          </div>
          <KrewMultiSelect
            options={krews}
            selectedIds={audienceKrewIds}
            onToggle={onToggleAudienceKrew}
            disabled={disabled}
            emptyLabel={krewsEmptyLabel}
          />
        </div>
      </div>

      {/* ── Contribution ─────────────────────────────────────── */}
      <div className='scope-picker__question'>
        <legend className='scope-picker__legend'>
          {contributionQuestion ?? (
            <FormattedMessage
              id='scope_picker.question.contribution'
              defaultMessage='Who can add to it?'
            />
          )}
        </legend>

        {audienceIsSelfOnly ? (
          <p className='scope-picker__note'>
            {intl.formatMessage(messages.selfOnlyNote)}
          </p>
        ) : (
          <>
            <div className='scope-picker__chips' role='radiogroup'>
              <ChipButton
                isSelected={contributionOpen}
                isDisabled={disabled}
                label={intl.formatMessage(messages.contributionOpen)}
                onSelect={handleOpen}
              />
              <ChipButton
                isSelected={!contributionOpen}
                isDisabled={disabled}
                label={intl.formatMessage(messages.contributionRestricted)}
                onSelect={handleRestricted}
              />
            </div>

            {!contributionOpen && (
              <>
                <div className='scope-picker__subpicker'>
                  <div className='scope-picker__subpicker-label'>
                    {intl.formatMessage(messages.contributorKrews)}
                  </div>
                  <KrewMultiSelect
                    options={krews}
                    selectedIds={contributorKrewIds}
                    onToggle={onToggleContributorKrew}
                    disabled={disabled}
                    emptyLabel={krewsEmptyLabel}
                  />
                </div>

                <div className='scope-picker__subpicker'>
                  <div className='scope-picker__subpicker-label'>
                    {intl.formatMessage(messages.contributorPeople)}
                  </div>
                  <AccountMultiSelect
                    value={contributorAccounts}
                    onChange={onContributorAccountsChange}
                    disabled={disabled}
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </fieldset>
  );
};
