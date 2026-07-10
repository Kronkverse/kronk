import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { defineMessages, useIntl, FormattedMessage } from 'react-intl';
import { Helmet } from 'react-helmet';

import ArrowBackIcon from '@/material-icons/400-24px/arrow_back.svg?react';
import SettingsIcon from '@/material-icons/400-24px/settings.svg?react';
import Column from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { apiRequestGet, apiRequestPost, apiRequestDelete } from 'mastodon/api';
import { useKorner } from 'mastodon/hooks/useKorner';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';
import type { ApiKornerSettingJSON } from 'mastodon/api_types/korners';

// Per-korner settings space (spec §K). Every korner gets a settings
// page at /hub/<slug>/settings. Framework-provided controls (tune-in,
// push preferences) come first; manifest-declared korner-specific
// settings render below, driven from the manifest's `settings:` block.

const messages = defineMessages({
  title: { id: 'korner_settings.title', defaultMessage: '{name} settings' },
  loading: { id: 'korner_settings.loading', defaultMessage: 'Loading…' },
  backToKorner: { id: 'korner_settings.back', defaultMessage: 'Back to {name}' },
});

interface UserKornerSettings {
  slug: string;
  tuned_in: boolean;
  push_enabled: boolean;
  values: Record<string, unknown>;
}

const SettingField: React.FC<{
  setting: ApiKornerSettingJSON;
  value: unknown;
  onChange: (value: unknown) => void;
}> = ({ setting, value, onChange }) => {
  const label = setting.name.replace(/_/g, ' ');

  if (setting.kind === 'boolean') {
    return (
      <label className='korner-settings__row korner-settings__row--boolean'>
        <input
          type='checkbox'
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className='korner-settings__label'>{label}</span>
      </label>
    );
  }

  if (setting.kind === 'string' && Array.isArray(setting.options)) {
    return (
      <label className='korner-settings__row'>
        <span className='korner-settings__label'>{label}</span>
        <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          {setting.options.map((opt) => (
            <option key={String(opt)} value={String(opt)}>
              {String(opt)}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (setting.kind === 'string') {
    return (
      <label className='korner-settings__row'>
        <span className='korner-settings__label'>{label}</span>
        <input type='text' value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
      </label>
    );
  }

  if (setting.kind === 'integer' || setting.kind === 'number') {
    return (
      <label className='korner-settings__row'>
        <span className='korner-settings__label'>{label}</span>
        <input
          type='number'
          value={Number(value ?? 0)}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </label>
    );
  }

  return (
    <div className='korner-settings__row'>
      <span className='korner-settings__label'>{label}</span>
      <span className='korner-settings__value-muted'>
        Setting kind &quot;{setting.kind}&quot; not yet supported here.
      </span>
    </div>
  );
};

export const KornerSettings: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const { slug } = useParams<{ slug: string }>();
  const korner = useKorner(slug);
  const Icon = useKornerIcon(slug);

  const [state, setState] = useState<UserKornerSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiRequestGet<UserKornerSettings>(`v1/korners/${slug}/settings`);
        if (!cancelled) setState(data);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const setValue = useCallback(
    (name: string, value: unknown) => {
      setState((prev) => (prev ? { ...prev, values: { ...prev.values, [name]: value } } : prev));
    },
    [],
  );

  const toggleTuneIn = useCallback(async () => {
    if (!slug || !state) return;
    const next = !state.tuned_in;
    setState({ ...state, tuned_in: next });
    try {
      if (next) {
        await apiRequestDelete(`v1/korners/${slug}/tune_out`);
      } else {
        await apiRequestPost(`v1/korners/${slug}/tune_out`, {});
      }
    } catch {
      setState((prev) => (prev ? { ...prev, tuned_in: !next } : prev));
    }
  }, [slug, state]);

  const save = useCallback(async () => {
    if (!slug || !state) return;
    setSaving(true);
    setError(null);
    try {
      const data = await apiRequestPost<UserKornerSettings>(`v1/korners/${slug}/settings`, {
        push_enabled: state.push_enabled,
        values: state.values,
      });
      setState(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [slug, state]);

  const title = korner
    ? intl.formatMessage(messages.title, { name: korner.name })
    : intl.formatMessage(messages.title, { name: slug ?? 'Korner' });

  const kornerSettings = korner?.settings ?? [];
  const userScopedSettings = kornerSettings.filter((s) => (s.scope ?? 'user') === 'user');

  return (
    <Column>
      <ColumnHeader title={title} icon='settings' iconComponent={SettingsIcon} multiColumn={multiColumn} showBackButton />

      <Helmet>
        <title>{title}</title>
      </Helmet>

      <div className='scrollable korner-settings'>
        <Link to={`/hub/${slug}`} className='korner-settings__back'>
          <ArrowBackIcon />
          <FormattedMessage
            id='korner_settings.back'
            defaultMessage='Back to {name}'
            values={{ name: korner?.name ?? slug }}
          />
        </Link>

        <header className='korner-settings__header'>
          <span className='korner-settings__glyph' aria-hidden='true'>
            <Icon />
          </span>
          <div>
            <h1 className='korner-settings__title'>{korner?.name ?? slug}</h1>
            {korner?.hub_teaser?.static && (
              <p className='korner-settings__subtitle'>{String(korner.hub_teaser.static)}</p>
            )}
          </div>
        </header>

        {error && <p className='korner-settings__error'>{error}</p>}

        {!state && !error && (
          <p className='korner-settings__loading'>{intl.formatMessage(messages.loading)}</p>
        )}

        {state && (
          <>
            <section className='korner-settings__section'>
              <h2 className='korner-settings__section-title'>
                <FormattedMessage id='korner_settings.framework' defaultMessage='Framework settings' />
              </h2>
              <label className='korner-settings__row korner-settings__row--boolean'>
                <input type='checkbox' checked={state.tuned_in} onChange={toggleTuneIn} />
                <span className='korner-settings__label'>
                  <FormattedMessage id='korner_settings.tuned_in' defaultMessage='Tuned in' />
                </span>
                <span className='korner-settings__hint'>
                  <FormattedMessage
                    id='korner_settings.tuned_in_hint'
                    defaultMessage='Untick to hide this korner from your feed and Hub.'
                  />
                </span>
              </label>

              <label className='korner-settings__row korner-settings__row--boolean'>
                <input
                  type='checkbox'
                  checked={state.push_enabled}
                  onChange={(e) => setState({ ...state, push_enabled: e.target.checked })}
                />
                <span className='korner-settings__label'>
                  <FormattedMessage id='korner_settings.push' defaultMessage='Push notifications' />
                </span>
                <span className='korner-settings__hint'>
                  <FormattedMessage
                    id='korner_settings.push_hint'
                    defaultMessage='Get pushed nudges from this korner.'
                  />
                </span>
              </label>
            </section>

            {userScopedSettings.length > 0 && (
              <section className='korner-settings__section'>
                <h2 className='korner-settings__section-title'>
                  <FormattedMessage
                    id='korner_settings.korner_specific'
                    defaultMessage='{name} settings'
                    values={{ name: korner?.name ?? slug }}
                  />
                </h2>
                {userScopedSettings.map((s) => (
                  <SettingField
                    key={s.name}
                    setting={s}
                    value={state.values[s.name] ?? s.default}
                    onChange={(v) => setValue(s.name, v)}
                  />
                ))}
              </section>
            )}

            <div className='korner-settings__save'>
              <button type='button' onClick={() => void save()} disabled={saving}>
                {saving ? (
                  <FormattedMessage id='korner_settings.saving' defaultMessage='Saving…' />
                ) : (
                  <FormattedMessage id='korner_settings.save' defaultMessage='Save' />
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </Column>
  );
};

export default KornerSettings;
