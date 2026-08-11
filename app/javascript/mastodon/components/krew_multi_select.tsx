import { memo, useCallback } from 'react';

import type { KrewOption } from 'mastodon/components/reach_dropdown';

// KrewMultiSelect — a reusable inline "pick some krews" control: each krew is
// a toggle chip. Controlled by `selectedIds` + `onToggle`. Used for the
// additive audience-krew and contributor-krew sets in the Albutts scope
// picker; the compact dropdown form of the same idea lives in ReachDropdown's
// krew submenu.

interface Props {
  options: readonly KrewOption[];
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
  emptyLabel?: React.ReactNode;
}

const KrewChip = memo<{
  krew: KrewOption;
  selected: boolean;
  disabled: boolean;
  onToggle: (id: string) => void;
}>(({ krew, selected, disabled, onToggle }) => {
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
      className={`krew-multi-select__chip${selected ? ' krew-multi-select__chip--selected' : ''}`}
      title={krew.hint}
    >
      {krew.name}
    </button>
  );
});
KrewChip.displayName = 'KrewChip';

export const KrewMultiSelect: React.FC<Props> = ({
  options,
  selectedIds,
  onToggle,
  disabled = false,
  emptyLabel,
}) => {
  if (options.length === 0) {
    return emptyLabel ? (
      <p className='krew-multi-select__empty'>{emptyLabel}</p>
    ) : null;
  }

  return (
    <div className='krew-multi-select' role='group'>
      {options.map((krew) => (
        <KrewChip
          key={krew.id}
          krew={krew}
          selected={selectedIds.includes(krew.id)}
          disabled={disabled}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
};
