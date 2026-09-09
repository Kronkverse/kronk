import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import CheckIcon from '@/material-icons/400-24px/check.svg?react';
import { Icon } from 'mastodon/components/icon';
import {
  REACH_ORDER,
  REACH_META,
  reachMessages,
} from 'mastodon/components/reach_dropdown';
import type { ReachValue } from 'mastodon/components/reach_dropdown';
import { ScopeMark } from 'mastodon/components/scope_mark';

// ReachBoxes — the reach ladder as a row of selectable Kronk boxes (glyph +
// label + hint), instead of ReachDropdown's compact menu. Same vocabulary and
// ring-mark glyphs as every other reach control (shared from reach_dropdown),
// so the picker reads Me / Mates / Orbit / Kronkverse consistently. Used where
// the choice deserves to be laid out and compared at a glance rather than
// hidden behind a dropdown — e.g. the profile-visibility setting.

interface Props {
  value: ReachValue;
  onChange: (value: ReachValue) => void;
  // Rungs to drop from the row (same semantics as ReachDropdown's `hide`).
  hide?: readonly ReachValue[];
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

export const ReachBoxes: React.FC<Props> = ({ value, onChange, hide }) => {
  const intl = useIntl();
  const hideSet = new Set<ReachValue>(hide ?? []);
  const order = REACH_ORDER.filter((option) => !hideSet.has(option));

  return (
    <div className='reach-boxes' role='radiogroup'>
      {order.map((option) => (
        <ReachBox
          key={option}
          option={option}
          selected={option === value}
          label={intl.formatMessage(reachMessages[REACH_META[option].labelId])}
          hint={intl.formatMessage(reachMessages[REACH_META[option].hintId])}
          onSelect={onChange}
        />
      ))}
    </div>
  );
};
