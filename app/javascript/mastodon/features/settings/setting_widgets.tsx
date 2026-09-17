// Shared settings widget engine (settings rebuild §5.2). One renderer for
// every framework-rendered settings surface — per-korner settings (§K) and
// the personal settings sections — so they are one system, not per-feature
// reinventions. Widget kinds follow §K.4. Class names are shared with the
// korner settings styles for now; a later kit slice neutralises them.

import { useCallback } from 'react';

import {
  DEFAULT_PURPLE_HUE,
  MAX_PURPLE_HUE,
  MIN_PURPLE_HUE,
} from 'mastodon/utils/personal_appearance';

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

// unknown → string, safely: primitives stringify; anything else returns
// the fallback so `String({...})` never leaks '[object Object]' into a
// DOM value. Used for typed:unknown settings values coming out of jsonb.
const asString = (v: unknown, fallback = ''): string => {
  if (v == null) return fallback;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return fallback;
};

export const BooleanWidget: React.FC<{
  value: boolean;
  onChange: (v: boolean) => void;
  ariaLabel?: string;
}> = ({ value, onChange, ariaLabel }) => {
  const handleChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      onChange(e.target.checked);
    },
    [onChange],
  );
  return (
    <label className='korner-settings__toggle'>
      <input
        type='checkbox'
        checked={value}
        onChange={handleChange}
        aria-label={ariaLabel}
      />
      <span className='korner-settings__toggle-track' aria-hidden='true' />
    </label>
  );
};

export const EnumWidget: React.FC<{
  options: string[];
  value: string;
  onChange: (v: string) => void;
}> = ({ options, value, onChange }) => {
  const handleChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement | HTMLSelectElement>
  >(
    (e) => {
      onChange(e.currentTarget.value);
    },
    [onChange],
  );
  // Spec §K.4: radios when ≤3 options, dropdown otherwise.
  if (options.length <= 3) {
    return (
      <div className='korner-settings__radios'>
        {options.map((opt) => (
          <label key={opt} className='korner-settings__radio'>
            <input
              type='radio'
              value={opt}
              checked={value === opt}
              onChange={handleChange}
            />
            <span>{humanize(opt)}</span>
          </label>
        ))}
      </div>
    );
  }
  return (
    <select value={value} onChange={handleChange}>
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
  const handleChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      const opt = e.currentTarget.value;
      const next = new Set(value);
      if (next.has(opt)) next.delete(opt);
      else next.add(opt);
      onChange(options.filter((o) => next.has(o)));
    },
    [options, value, onChange],
  );
  return (
    <div className='korner-settings__multi'>
      {options.map((opt) => (
        <label key={opt} className='korner-settings__multi-item'>
          <input
            type='checkbox'
            value={opt}
            checked={selected.has(opt)}
            onChange={handleChange}
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
  const handleChange = useCallback<React.ChangeEventHandler<HTMLSelectElement>>(
    (e) => {
      onChange(e.currentTarget.value);
    },
    [onChange],
  );
  return (
    <select value={value} onChange={handleChange}>
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

// Kronk Personal Appearance hue slider. Rotates the whole
// --kronk-purple-* family (primary / bright / deep / muted / accent)
// around a shared anchor lightness + chroma, so the palette warms or
// cools as one — nothing drifts out of family. Range is clamped to
// the purple band (260°–310°); the server enforces the same window.
//
// The swatch strip below the slider previews all five purples at the
// live hue so a user can feel the whole family shift, not just the
// accent chip.
export const HueWidget: React.FC<{
  // Accept string too: Mastodon's UserSettings::Setting with a nil
  // default type-casts stored values through ActiveModel::Type::String,
  // so a saved integer round-trips as `"285"` on the next payload
  // read. Without this the slider snaps back to the anchor after
  // every drag because a typeof === 'number' check falls through.
  value: number | string | null | undefined;
  onChange: (v: number | null) => void;
}> = ({ value, onChange }) => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : null;
  const current =
    parsed !== null && Number.isFinite(parsed) ? parsed : DEFAULT_PURPLE_HUE;

  const handleChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      onChange(Number(e.target.value));
    },
    [onChange],
  );

  const handleReset = useCallback(() => {
    onChange(null);
  }, [onChange]);

  const swatches = [
    { name: 'muted', l: 42, c: 0.06 },
    { name: 'primary', l: 32, c: 0.14 },
    { name: 'deep', l: 30, c: 0.19 },
    { name: 'accent', l: 50, c: 0.2 },
    { name: 'bright', l: 68, c: 0.2 },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        width: '100%',
      }}
    >
      <input
        type='range'
        min={MIN_PURPLE_HUE}
        max={MAX_PURPLE_HUE}
        step={1}
        value={current}
        onChange={handleChange}
        aria-label='Purple hue'
        style={{
          width: '100%',
          accentColor: `oklch(50% 0.20 ${current})`,
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          color: 'var(--text-muted)',
          fontSize: '0.8rem',
        }}
      >
        <span>Cooler</span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>hue {current}°</span>
        <span>Warmer</span>
      </div>
      <div
        style={{
          display: 'flex',
          gap: '4px',
          height: '18px',
          borderRadius: 'var(--radius-small)',
          overflow: 'hidden',
        }}
      >
        {swatches.map((s) => (
          <span
            key={s.name}
            title={`purple-${s.name} @ ${current}°`}
            style={{
              flex: 1,
              background: `oklch(${s.l}% ${s.c} ${current})`,
              borderRadius: 'var(--radius-small)',
            }}
          />
        ))}
      </div>
      {value != null && (
        <button
          type='button'
          onClick={handleReset}
          style={{
            alignSelf: 'flex-start',
            padding: '0.2rem 0.55rem',
            background: 'transparent',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-round)',
            color: 'var(--text-muted)',
            fontSize: '0.75rem',
            cursor: 'pointer',
          }}
        >
          Reset to default
        </button>
      )}
    </div>
  );
};

const StringInput: React.FC<{
  value: unknown;
  onChange: (v: unknown) => void;
}> = ({ value, onChange }) => {
  const handleChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      onChange(e.target.value);
    },
    [onChange],
  );
  return <input type='text' value={asString(value)} onChange={handleChange} />;
};

const NumberInput: React.FC<{
  value: unknown;
  onChange: (v: unknown) => void;
}> = ({ value, onChange }) => {
  const handleChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      onChange(Number(e.target.value));
    },
    [onChange],
  );
  return (
    <input type='number' value={Number(value ?? 0)} onChange={handleChange} />
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
          <BooleanWidget
            value={value === true}
            onChange={onChange}
            ariaLabel={label}
          />
        )}
      </div>
      {description && <p className='korner-settings__hint'>{description}</p>}
      {setting.kind === 'enum' && (
        <EnumWidget
          options={options}
          value={asString(value, asString(setting.default))}
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
          value={asString(value, asString(setting.default, 'PT1H'))}
          onChange={onChange}
        />
      )}
      {setting.kind === 'string' && (
        <StringInput value={value} onChange={onChange} />
      )}
      {(setting.kind === 'integer' || setting.kind === 'number') && (
        <NumberInput value={value} onChange={onChange} />
      )}
      {setting.kind === 'accent' && (
        <AccentWidget
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
        />
      )}
      {setting.kind === 'hue' && (
        <HueWidget
          value={
            typeof value === 'number' || typeof value === 'string'
              ? value
              : null
          }
          onChange={onChange}
        />
      )}
    </div>
  );
};

// Convenience wrapper for `.map(setting => ...)` iterations that want a
// stable onChange handler without building one per iteration. Callers
// supply `onSet(name, value)`; the wrapper closes over the setting's
// name in a useCallback keyed by name identity.
export const NamedSettingRow: React.FC<{
  setting: SettingDescriptor;
  value: unknown;
  onSet: (name: string, value: unknown) => void;
}> = ({ setting, value, onSet }) => {
  const handleChange = useCallback(
    (v: unknown) => {
      onSet(setting.name, v);
    },
    [setting.name, onSet],
  );
  return <SettingRow setting={setting} value={value} onChange={handleChange} />;
};
