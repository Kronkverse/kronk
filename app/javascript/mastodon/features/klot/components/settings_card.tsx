import { useCallback } from 'react';

import { FormattedMessage } from 'react-intl';

interface Props {
  cycleLength: number;
  periodLength: number;
  onChange: (patch: {
    cycle_length?: number;
    period_length?: number;
  }) => Promise<void>;
}

const clamp = (value: number, min: number, max: number, fallback: number) => {
  if (Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
};

export const SettingsCard: React.FC<Props> = ({
  cycleLength,
  periodLength,
  onChange,
}) => {
  const handleCycle = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = clamp(Number(e.target.value), 18, 45, 28);
      await onChange({ cycle_length: next });
    },
    [onChange],
  );

  const handlePeriod = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = clamp(Number(e.target.value), 1, 12, 5);
      await onChange({ period_length: next });
    },
    [onChange],
  );

  return (
    <div className='klot-card'>
      <h3 className='klot-card__title serif'>
        <FormattedMessage
          id='klot.settings.title'
          defaultMessage='Your rhythm'
        />
      </h3>
      <p className='klot-card__lead'>
        <FormattedMessage
          id='klot.settings.lead'
          defaultMessage='Set your typical cycle length and how long your period usually lasts.'
        />
      </p>

      <div className='klot-fields'>
        <div className='klot-field'>
          <label className='klot-field__label' htmlFor='klot-cycle-len'>
            <FormattedMessage
              id='klot.settings.cycle_length'
              defaultMessage='Cycle length (days)'
            />
          </label>
          <input
            id='klot-cycle-len'
            type='number'
            min={18}
            max={45}
            className='klot-field__input'
            defaultValue={cycleLength}
            onBlur={handleCycle}
          />
        </div>

        <div className='klot-field'>
          <label className='klot-field__label' htmlFor='klot-period-len'>
            <FormattedMessage
              id='klot.settings.period_length'
              defaultMessage='Period length (days)'
            />
          </label>
          <input
            id='klot-period-len'
            type='number'
            min={1}
            max={12}
            className='klot-field__input'
            defaultValue={periodLength}
            onBlur={handlePeriod}
          />
        </div>
      </div>
    </div>
  );
};
