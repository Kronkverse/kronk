import { useCallback } from 'react';

// The list "Link one of yours" opens on a Krew's page: your own albums or
// events that aren't in this Krew yet. Tap one to link it.
export interface LinkChoice {
  id: string;
  label: string;
  detail?: string;
}

export const KrewLinkPicker: React.FC<{
  choices: LinkChoice[] | null;
  emptyLabel: string;
  disabled: boolean;
  onPick: (id: string) => void;
}> = ({ choices, emptyLabel, disabled, onPick }) => {
  if (choices === null) return null;
  if (choices.length === 0)
    return <p className='krew-detail__section-hint'>{emptyLabel}</p>;

  return (
    <ul className='krew-detail__link-picker'>
      {choices.map((choice) => (
        <LinkChoiceRow
          key={choice.id}
          choice={choice}
          disabled={disabled}
          onPick={onPick}
        />
      ))}
    </ul>
  );
};

const LinkChoiceRow: React.FC<{
  choice: LinkChoice;
  disabled: boolean;
  onPick: (id: string) => void;
}> = ({ choice, disabled, onPick }) => {
  const handleClick = useCallback(() => {
    onPick(choice.id);
  }, [choice.id, onPick]);
  return (
    <li>
      <button
        type='button'
        className='krew-detail__link-choice'
        onClick={handleClick}
        disabled={disabled}
      >
        <span className='krew-detail__event-title'>{choice.label}</span>
        {choice.detail && (
          <span className='krew-detail__event-when'>{choice.detail}</span>
        )}
      </button>
    </li>
  );
};
