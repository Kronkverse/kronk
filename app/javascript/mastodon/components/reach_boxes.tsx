import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import CheckIcon from '@/material-icons/400-24px/check.svg?react';
import { Icon } from 'mastodon/components/icon';
import {
  REACH_ORDER,
  REACH_META,
  reachMessages,
} from 'mastodon/components/reach_dropdown';
import type {
  KrewOption,
  ReachValue,
} from 'mastodon/components/reach_dropdown';
import { ScopeMark } from 'mastodon/components/scope_mark';

// ReachBoxes — the reach ladder as a row of selectable Kronk boxes (glyph +
// label + hint), instead of ReachDropdown's compact menu. Same vocabulary and
// ring-mark glyphs as every other reach control (shared from reach_dropdown),
// so the picker reads Me / Mates / Orbit / Kronkverse consistently. Used where
// the choice deserves to be laid out and compared at a glance rather than
// hidden behind a dropdown — e.g. the profile-visibility setting.
//
// Krews are additive, exactly as in ReachDropdown: they sit on top of whatever
// rung is chosen rather than being a rung of their own, so they belong inside
// this control rather than in a section beside it. The row only renders for
// someone who is actually in a krew — an empty "you're not in any krews yet"
// strip is a question nobody asked.

interface Props {
  value: ReachValue;
  onChange: (value: ReachValue) => void;
  // Rungs to drop from the row (same semantics as ReachDropdown's `hide`).
  hide?: readonly ReachValue[];
  // Additive krew axis. Provide all three to grow the krew row; omit them, or
  // pass an empty `krews`, and nothing renders.
  krews?: readonly KrewOption[];
  selectedKrewIds?: readonly string[];
  onToggleKrew?: (id: string) => void;
  disabled?: boolean;
}

const ReachBox: React.FC<{
  option: ReachValue;
  selected: boolean;
  label: string;
  hint: string;
  onSelect: (value: ReachValue) => void;
}> = ({ option, selected, label, hint, onSelect }) => {
  const handleClick = useCallback(() => {
    onSelect(option);
  }, [onSelect, option]);

  return (
    <button
      type='button'
      role='radio'
      aria-checked={selected}
      onClick={handleClick}
      className={`reach-boxes__box${selected ? ' reach-boxes__box--selected' : ''}`}
    >
      <ScopeMark
        kind={REACH_META[option].mark}
        size={30}
        className='reach-boxes__mark'
      />
      <span className='reach-boxes__label'>{label}</span>
      <span className='reach-boxes__hint'>{hint}</span>
      <Icon id='' icon={CheckIcon} className='reach-boxes__tick' />
    </button>
  );
};

const KrewChip: React.FC<{
  krew: KrewOption;
  selected: boolean;
  disabled?: boolean;
  onToggle: (id: string) => void;
}> = ({ krew, selected, disabled, onToggle }) => {
  const handleClick = useCallback(() => {
    onToggle(krew.id);
  }, [onToggle, krew.id]);

  return (
    <button
      type='button'
      role='checkbox'
      aria-checked={selected}
      disabled={disabled}
      onClick={handleClick}
      className={`reach-boxes__krew${selected ? ' reach-boxes__krew--selected' : ''}`}
    >
      {krew.name}
    </button>
  );
};

export const ReachBoxes: React.FC<Props> = ({
  value,
  onChange,
  hide,
  krews,
  selectedKrewIds,
  onToggleKrew,
  disabled,
}) => {
  const intl = useIntl();
  const hideSet = new Set<ReachValue>(hide ?? []);
  const order = REACH_ORDER.filter((option) => !hideSet.has(option));
  const picked = new Set(selectedKrewIds ?? []);
  const showKrews = Boolean(krews?.length && onToggleKrew);

  return (
    <div className='reach-boxes'>
      <div className='reach-boxes__row' role='radiogroup'>
        {order.map((option) => (
          <ReachBox
            key={option}
            option={option}
            selected={option === value}
            label={intl.formatMessage(
              reachMessages[REACH_META[option].labelId],
            )}
            hint={intl.formatMessage(reachMessages[REACH_META[option].hintId])}
            onSelect={onChange}
          />
        ))}
      </div>

      {showKrews && onToggleKrew && (
        <div className='reach-boxes__krews'>
          <span className='reach-boxes__krews-hint'>
            {intl.formatMessage(reachMessages.krewsRowHint)}
          </span>
          <div className='reach-boxes__krew-list'>
            {krews?.map((krew) => (
              <KrewChip
                key={krew.id}
                krew={krew}
                selected={picked.has(krew.id)}
                disabled={disabled}
                onToggle={onToggleKrew}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
