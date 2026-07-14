// Shared settings widget engine (settings rebuild §5.2). One renderer for
// every framework-rendered settings surface — per-korner settings (§K) and
// the personal settings sections — so they are one system, not per-feature
// reinventions. Widget kinds follow §K.4. Class names are shared with the
// korner settings styles for now; a later kit slice neutralises them.

import { useCallback } from 'react';

export interface SettingDescriptor {
  name: string;
  kind: string;
  options?: unknown[] | null;
  label?: string | null;
  description?: string | null;
  default?: unknown;
}

export const humanize = (name: string) =>
  name.replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const BooleanWidget: React.FC<{
  value: boolean;
  onChange: (v: boolean) => void;
}> = ({ value, onChange }) => (
  <label className='korner-settings__toggle'>
    <input
      type='checkbox'
      checked={!!value}
      onChange={(e) => {
        onChange(e.target.checked);
      }}
    />
    <span className='korner-settings__toggle-track' aria-hidden='true' />
  </label>
);

export const EnumWidget: React.FC<{
  options: string[];
  value: string;
  onChange: (v: string) => void;
}> = ({ options, value, onChange }) => {
  // Spec §K.4: radios when ≤3 options, dropdown otherwise.
  if (options.length <= 3) {
    return (
      <div className='korner-settings__radios'>
        {options.map((opt) => (
          <label key={opt} className='korner-settings__radio'>
            <input
              type='radio'
              checked={value === opt}
              onChange={() => {
                onChange(opt);
              }}
            />
            <span>{humanize(opt)}</span>
          </label>
        ))}
      </div>
    );
  }
  return (
    <select
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
      }}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {humanize(opt)}
        </option>
      ))}
    </select>
  );
};

export const MultiEnumWidget: React.FC<{
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}> = ({ options, value, onChange }) => {
  const selected = new Set(value);
  const toggle = (opt: string) => {
    const next = new Set(selected);
    if (next.has(opt)) next.delete(opt);
    else next.add(opt);
    onChange(options.filter((o) => next.has(o)));
  };
  return (
    <div className='korner-settings__multi'>
      {options.map((opt) => (
        <label key={opt} className='korner-settings__multi-item'>
          <input
            type='checkbox'
            checked={selected.has(opt)}
            onChange={() => {
              toggle(opt);
            }}
          />
          <span>{humanize(opt)}</span>
        </label>
      ))}
    </div>
  );
};

export const DurationWidget: React.FC<{
  options?: string[];
  value: string;
  onChange: (v: string) => void;
}> = ({ options, value, onChange }) => {
  const presets = options?.length ? options : ['PT15M', 'PT1H', 'P1D'];
  return (
    <select
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
      }}
    >
      {presets.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </select>
  );
};

// Kronk Personal Appearance accent picker. Constrained to the purple family so
// personalisation never breaks Kronk's identity — a spread of purple presets
// plus a custom picker (server-side hue validation is the backstop).
const PURPLE_PRESETS = [
  '#4414cc',
  '#5b3fd6',
  '#6364ff',
  '#6d5cff',
  '#7241ff',
  '#7c5cff',
  '#7c3aed',
  '#8b5cf6',
  '#9061ff',
  '#8c8dff',
  '#a78bfa',
];

export const AccentWidget: React.FC<{
  value: string;
  onChange: (v: string) => void;
}> = ({ value, onChange }) => {
  const handlePreset = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const color = e.currentTarget.dataset.color;
      if (color) onChange(color);
    },
    [onChange],
  );
  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange],
  );
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        alignItems: 'center',
      }}
    >
      {PURPLE_PRESETS.map((p) => (
        <button
          key={p}
          type='button'
          data-color={p}
          title={p}
          aria-label={p}
          onClick={handlePreset}
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '6px',
            cursor: 'pointer',
            background: p,
            border:
              value === p
                ? '2px solid var(--text-primary)'
                : '1px solid var(--border-default)',
          }}
        />
      ))}
      <input
        type='color'
        aria-label='Custom purple'
        value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#6364ff'}
        onChange={handleInput}
        style={{
          width: '30px',
          height: '26px',
          padding: 0,
          border: '1px solid var(--border-default)',
          borderRadius: '6px',
          background: 'none',
          cursor: 'pointer',
        }}
      />
    </div>
  );
};

export const SettingRow: React.FC<{
  setting: SettingDescriptor;
  value: unknown;
  onChange: (value: unknown) => void;
}> = ({ setting, value, onChange }) => {
  const label = setting.label ?? humanize(setting.name);
  const description = setting.description;
  const options = Array.isArray(setting.options)
    ? setting.options.map(String)
    : [];

  return (
    <div className='korner-settings__row'>
      <div className='korner-settings__row-header'>
        <span className='korner-settings__label'>{label}</span>
        {setting.kind === 'boolean' && (
          <BooleanWidget value={value === true} onChange={onChange} />
        )}
      </div>
      {description && <p className='korner-settings__hint'>{description}</p>}
      {setting.kind === 'enum' && (
        <EnumWidget
          options={options}
          value={String(value ?? setting.default ?? '')}
          onChange={onChange}
        />
      )}
      {setting.kind === 'multi_enum' && (
        <MultiEnumWidget
          options={options}
          value={Array.isArray(value) ? (value as unknown[]).map(String) : []}
          onChange={onChange}
        />
      )}
      {setting.kind === 'duration' && (
        <DurationWidget
          options={options}
          value={String(value ?? setting.default ?? 'PT1H')}
          onChange={onChange}
        />
      )}
      {setting.kind === 'string' && (
        <input
          type='text'
          value={String(value ?? '')}
          onChange={(e) => {
            onChange(e.target.value);
          }}
        />
      )}
      {(setting.kind === 'integer' || setting.kind === 'number') && (
        <input
          type='number'
          value={Number(value ?? 0)}
          onChange={(e) => {
            onChange(Number(e.target.value));
          }}
        />
      )}
      {setting.kind === 'accent' && (
        <AccentWidget
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
        />
      )}
    </div>
  );
};
