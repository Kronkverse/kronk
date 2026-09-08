// Kronk Scope Picker — reach and contribution, shared across every korner
// that scopes both. See docs/kronk_scope_picker.md and
// docs/rebuild/krew_axis_migration.md.
//
// It used to ask two questions in words — "Who's this for?" above one set of
// chips, "Who can add to it?" above another — and then answer them with
// options that needed the question to make sense. A control that has to be
// captioned isn't finished (Tal, 2026-09-08). The reach half is now the
// standard ReachBoxes ladder, which carries its own label and hint per rung
// (Me · Only you / Mates · People who mate you back / …), and the
// contribution half states what each option does rather than relying on a
// heading to say what is being chosen.
//
// Both axes are ADDITIVE (2026-08-11):
//   * Audience    = a reach tier (self_only/mates/orbit/public) + any krews.
//   * Contribution= a base (anyone who can see it, OR a restricted roster)
//                   + a roster that is the union of specific people and krews.
//
// Controlled component. The parent owns all state and passes callbacks; this
// renders the two-question UI + the additive sub-pickers.

import { useCallback, useMemo } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useAvailableKrews } from '../hooks/useAvailableKrews';

import type { AccountLite } from './account_multi_select';
import { AccountMultiSelect } from './account_multi_select';
import { KrewMultiSelect } from './krew_multi_select';
import { ReachBoxes } from './reach_boxes';
import type { KrewOption, ReachValue } from './reach_dropdown';
import { REACH_ORDER } from './reach_dropdown';

// ────────────────────────────────────────────────────────────────
// Vocabulary. The reach tiers and their labels live in reach_dropdown and
// are rendered by ReachBoxes — this component no longer keeps a second copy
// of them, which is how "Just me / My mates / My orbit" drifted from the
// standard's "Me / Mates / Orbit" in the first place. `krew` stays in the
// union for back-compat but is not a tier: krews are additive.
// ────────────────────────────────────────────────────────────────

export type VisibilityScope =
  | 'public'
  | 'mates'
  | 'orbit'
  | 'krew'
  | 'self_only';

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
    defaultMessage: 'Anyone who can see it can add',
  },
  contributionRestricted: {
    id: 'scope_picker.contribution.restricted',
    defaultMessage: 'Only people I choose can add',
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

  // `krew` is a legacy tier that is no longer offered — krews are additive
  // now. A row still carrying it keeps its stored value untouched; it just has
  // no rung lit until the owner picks one, which is honest about a value the
  // ladder can no longer express.
  const reachValue = REACH_ORDER.includes(visibility as ReachValue)
    ? (visibility as ReachValue)
    : ('' as ReachValue);

  // ReachBoxes hides rungs; ScopePicker's callers declare the ones they offer.
  const hiddenRungs = useMemo(
    () => REACH_ORDER.filter((rung) => !visibilityOptions.includes(rung)),
    [visibilityOptions],
  );

  const handleReachChange = useCallback(
    (next: ReachValue) => {
      onVisibilityChange(next);
    },
    [onVisibilityChange],
  );

  const rootClass = `scope-picker ${className ?? ''}`.trim();

  const krewsEmptyLabel = useMemo(
    () => intl.formatMessage(messages.noKrews),
    [intl],
  );

  return (
    <fieldset className={rootClass} disabled={disabled}>
      {/* ── Audience ─────────────────────────────────────────── */}
      {/* The reach ladder every other Kronk surface uses, rather than this
          component's own chips: same vocabulary, same glyphs, same hints, so
          the choice reads identically wherever it is made. Krews ride inside
          it because they are additive to a rung, not an alternative to one —
          and they only appear for someone who is in one. */}
      <ReachBoxes
        value={reachValue}
        onChange={handleReachChange}
        hide={hiddenRungs}
        krews={krews}
        selectedKrewIds={audienceKrewIds}
        onToggleKrew={onToggleAudienceKrew}
        disabled={disabled}
      />

      {/* ── Contribution ─────────────────────────────────────── */}
      <div className='scope-picker__question'>
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
