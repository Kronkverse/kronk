/* eslint-disable @typescript-eslint/no-unnecessary-condition --
 * `cancelled` mutates in the useEffect cleanup after the async fetch
 * reads it. TS control-flow doesn't track the mutation across the
 * closure so the checks look "always truthy/falsy", but the guards
 * are load-bearing: without them setState fires after unmount. */

import { useEffect, useState, useCallback, useRef } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useParams } from 'react-router-dom';

import api, {
  apiRequestGet,
  apiRequestPost,
  apiRequestDelete,
} from 'mastodon/api';
import type {
  ApiKornerSettingJSON,
  ApiKornerNotificationTypeJSON,
} from 'mastodon/api_types/korners';
import { AllSettingsFooter } from 'mastodon/components/all_settings_footer';
import { Stage } from 'mastodon/components/stage';
import { SettingsSection } from 'mastodon/features/settings/section';
import { useKorner } from 'mastodon/hooks/useKorner';

// Per-korner settings space (spec §K). Autosave-driven, widget kinds
// from §K.4, one push toggle per manifest notification type (§K.3.2).

const messages = defineMessages({
  title: { id: 'korner_settings.title', defaultMessage: '{name} settings' },
  loading: { id: 'korner_settings.loading', defaultMessage: 'Loading…' },
  savedNow: { id: 'korner_settings.saved_now', defaultMessage: 'Saved' },
  saving: { id: 'korner_settings.saving', defaultMessage: 'Saving…' },
  save_error: {
    id: 'korner_settings.save_error',
    defaultMessage: 'Could not save',
  },
});

interface ServerSettings {
  slug: string;
  tuned_in: boolean;
  push_enabled: boolean;
  push_preferences: Record<string, boolean>;
  values: Record<string, unknown>;
  settings_schema: ApiKornerSettingJSON[];
  notifications_schema: ApiKornerNotificationTypeJSON[];
}

const humanize = (name: string) =>
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

// ---- widgets ---------------------------------------------------------------

const BooleanWidget: React.FC<{
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

const EnumWidget: React.FC<{
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

const MultiEnumWidget: React.FC<{
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

const DurationWidget: React.FC<{
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

// ---- setting row -----------------------------------------------------------

const SettingRow: React.FC<{
  setting: ApiKornerSettingJSON;
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
    </div>
  );
};

// Per-row wrappers give the map iterations a stable onChange callback
// (react/jsx-no-bind) without the parent having to build a closure per key.

const NotificationPrefRow: React.FC<{
  notif: ApiKornerNotificationTypeJSON;
  checked: boolean;
  onSet: (name: string, value: boolean) => void;
}> = ({ notif, checked, onSet }) => {
  const handleChange = useCallback(
    (v: boolean) => {
      onSet(notif.name, v);
    },
    [notif.name, onSet],
  );
  return (
    <div className='korner-settings__row'>
      <div className='korner-settings__row-header'>
        <span className='korner-settings__label'>{humanize(notif.name)}</span>
        <BooleanWidget
          value={checked}
          onChange={handleChange}
          ariaLabel={humanize(notif.name)}
        />
      </div>
      {notif.subject_type && (
        <p className='korner-settings__hint'>
          Subject: {notif.subject_type}
          {notif.interactive === false
            ? ' · passive notice'
            : ' · interactive nudge'}
        </p>
      )}
    </div>
  );
};

const NamedSettingRow: React.FC<{
  setting: ApiKornerSettingJSON;
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

// ---- page ------------------------------------------------------------------

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export const KornerSettings: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const { slug } = useParams<{ slug: string }>();
  const korner = useKorner(slug);

  const [state, setState] = useState<ServerSettings | null>(null);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiRequestGet<ServerSettings>(
          `v1/korners/${slug}/settings`,
        );
        if (!cancelled) setState(data);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Autosave one setting via PATCH. Debounced per-key so a rapid slider
  // change only fires once, but two independent settings save in
  // parallel. Errors flash briefly, then the status returns to idle.
  const save = useCallback(
    (name: string, value: unknown) => {
      if (!slug) return;
      const timers = debounceRef.current;
      if (timers[name]) clearTimeout(timers[name]);

      timers[name] = setTimeout(() => {
        setStatus('saving');
        void (async () => {
          try {
            const res = await api().patch(
              `/api/v1/korners/${slug}/settings/${encodeURIComponent(name)}`,
              { value },
            );
            setState(res.data as ServerSettings);
            setStatus('saved');
            setTimeout(() => {
              setStatus('idle');
            }, 1200);
          } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
            setStatus('error');
            setTimeout(() => {
              setStatus('idle');
            }, 2000);
          }
        })();
      }, 500);
    },
    [slug],
  );

  const setValue = useCallback(
    (name: string, value: unknown) => {
      setState((prev) =>
        prev ? { ...prev, values: { ...prev.values, [name]: value } } : prev,
      );
      save(name, value);
    },
    [save],
  );

  const setPushPref = useCallback(
    (notifType: string, value: boolean) => {
      setState((prev) =>
        prev
          ? {
              ...prev,
              push_preferences: {
                ...prev.push_preferences,
                [notifType]: value,
              },
            }
          : prev,
      );
      save(`push.${notifType}`, value);
    },
    [save],
  );

  const toggleTuneIn = useCallback(async () => {
    if (!slug || !state) return;
    const next = !state.tuned_in;
    setState({ ...state, tuned_in: next });
    setStatus('saving');
    try {
      if (next) {
        await apiRequestDelete(`v1/korners/${slug}/tune_out`);
      } else {
        await apiRequestPost(`v1/korners/${slug}/tune_out`, {});
      }
      setStatus('saved');
      setTimeout(() => {
        setStatus('idle');
      }, 1200);
    } catch {
      setState((prev) => (prev ? { ...prev, tuned_in: !next } : prev));
      setStatus('error');
      setTimeout(() => {
        setStatus('idle');
      }, 2000);
    }
  }, [slug, state]);

  const handleTuneInToggle = useCallback(() => {
    void toggleTuneIn();
  }, [toggleTuneIn]);

  const title = korner
    ? intl.formatMessage(messages.title, { name: korner.name })
    : intl.formatMessage(messages.title, { name: slug });

  return (
    <Stage label={title}>
      <Helmet>
        <title>{title}</title>
      </Helmet>

      <div className='scrollable korner-settings'>
        {/* The old in-body "← Back to {name}" pill retired in favour of
            the Frame's SettingsBadge in the SpaceNav slot, which routes
            back to /settings ("All settings"). See
            components/auto_settings_badge.tsx. */}
        <div className='korner-settings__topline'>
          <span
            className={`korner-settings__save-indicator korner-settings__save-indicator--${status}`}
          >
            {status === 'saving' && intl.formatMessage(messages.saving)}
            {status === 'saved' && intl.formatMessage(messages.savedNow)}
            {status === 'error' && intl.formatMessage(messages.save_error)}
          </span>
        </div>

        {/* Frame-adherent header (Standard §L12) — shared `.space-header`
            classes, matches the display-typography every korner + every
            personal settings leaf uses. The manifest icon retires with
            the local `.korner-settings__glyph`; the SpaceBadge above
            covers the identity affordance. */}
        <header className='space-header' data-frame-header=''>
          <h1 className='space-header__title'>{korner?.name ?? slug}</h1>
          {typeof korner?.hub_teaser?.static === 'string' && (
            <p className='space-header__tagline'>{korner.hub_teaser.static}</p>
          )}
        </header>

        {error && <p className='korner-settings__error'>{error}</p>}

        {!state && !error && (
          <p className='korner-settings__loading'>
            {intl.formatMessage(messages.loading)}
          </p>
        )}

        {state && (
          <>
            <SettingsSection
              heading={
                <FormattedMessage
                  id='korner_settings.tune_in_section'
                  defaultMessage='Tune-in'
                />
              }
            >
              <div className='korner-settings__row'>
                <div className='korner-settings__row-header'>
                  <span className='korner-settings__label'>
                    <FormattedMessage
                      id='korner_settings.tuned_in'
                      defaultMessage='Tuned in'
                    />
                  </span>
                  <BooleanWidget
                    value={state.tuned_in}
                    onChange={handleTuneInToggle}
                  />
                </div>
                <p className='korner-settings__hint'>
                  <FormattedMessage
                    id='korner_settings.tuned_in_hint'
                    defaultMessage="When tuned in, this korner's cards can appear in your feed, its icon shows unread counts, and notices flow into Nudges. Tune out to remove all of this — you can still visit directly."
                  />
                </p>
              </div>
            </SettingsSection>

            {state.notifications_schema.length > 0 && (
              <SettingsSection
                heading={
                  <FormattedMessage
                    id='korner_settings.push_section'
                    defaultMessage='Push notifications'
                  />
                }
              >
                {state.notifications_schema.map((n) => (
                  <NotificationPrefRow
                    key={n.name}
                    notif={n}
                    checked={state.push_preferences[n.name] === true}
                    onSet={setPushPref}
                  />
                ))}
              </SettingsSection>
            )}

            {state.settings_schema.length > 0 && (
              <SettingsSection
                heading={
                  <FormattedMessage
                    id='korner_settings.korner_section'
                    defaultMessage='{name} preferences'
                    values={{ name: korner?.name ?? slug }}
                  />
                }
              >
                {state.settings_schema
                  .filter((s) => (s.scope ?? 'user') === 'user')
                  .map((s) => (
                    <NamedSettingRow
                      key={s.name}
                      setting={s}
                      value={state.values[s.name] ?? s.default}
                      onSet={setValue}
                    />
                  ))}
              </SettingsSection>
            )}
          </>
        )}

        {/* Persistent route to the Settings hub (Tal 2026-09-04).
            The top-left SettingsBadge is contextual — takes you
            back to the korner. This footer is where you go if you
            want to see every setting on Kronk. */}
        <AllSettingsFooter />
      </div>
    </Stage>
  );
};
