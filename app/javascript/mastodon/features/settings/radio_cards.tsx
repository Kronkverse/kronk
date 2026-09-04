// Shared radio-card chooser for settings surfaces — a vertical list of
// `[radio · label · description]` cards, one active. Extracted from
// `krew-settings__access-choice*` (settings audit 2026-09-04): the
// framework EnumWidget uses inline radios for ≤3 options, but a card
// layout with descriptions was the shape Krew's Access section
// evolved into and is the right default when each choice has a
// consequence the user needs to read (not just a short label).
//
// Writes through immediately on change — callers get a stable
// change handler and don't need to manage per-choice callbacks.

import { useCallback } from 'react';

export interface RadioCardChoice<K extends string> {
  key: K;
  label: React.ReactNode;
  description?: React.ReactNode;
}

interface Props<K extends string> {
  name: string;
  value: K;
  choices: RadioCardChoice<K>[];
  onChange: (next: K) => void;
  disabled?: boolean;
  // Accessible label for the whole radio group — required because a
  // radio group without a legend is opaque to screen readers.
  ariaLabel?: string;
}

// The generic can be either widened to `string` or narrowed to a
// union like `'open' | 'invite_only' | ...` by the caller, so a
// consumer keeps its enum type safe end to end.
export const SettingsRadioCards = <K extends string>({
  name,
  value,
  choices,
  onChange,
  disabled,
  ariaLabel,
}: Props<K>) => {
  const handleChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      onChange(e.currentTarget.value as K);
    },
    [onChange],
  );

  return (
    <ul
      className='settings-radio-cards'
      role='radiogroup'
      aria-label={ariaLabel}
    >
      {choices.map((choice) => (
        <li key={choice.key}>
          <label
            className={`settings-radio-cards__choice${
              value === choice.key
                ? ' settings-radio-cards__choice--active'
                : ''
            }`}
          >
            <input
              type='radio'
              name={name}
              value={choice.key}
              checked={value === choice.key}
              disabled={disabled}
              onChange={handleChange}
              className='settings-radio-cards__radio'
            />
            <span className='settings-radio-cards__body'>
              <span className='settings-radio-cards__label'>
                {choice.label}
              </span>
              {choice.description && (
                <span className='settings-radio-cards__desc'>
                  {choice.description}
                </span>
              )}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
};
