/* eslint-disable @typescript-eslint/no-unnecessary-condition --
 * `cancelled` mutates in the useEffect cleanup after the async fetch
 * reads it. TS control-flow doesn't track the mutation across the
 * closure so the checks look "always truthy/falsy", but the guards
 * are load-bearing: without them setState fires after unmount. */

import { useEffect, useState, useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';
import type { MessageDescriptor } from 'react-intl';

import { Helmet } from 'react-helmet';

import TuneIcon from '@/material-icons/400-24px/tune.svg?react';
import { apiRequestGet, apiRequestPut } from 'mastodon/api';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { NamedSettingRow } from 'mastodon/features/settings/setting_widgets';
import type { SettingDescriptor } from 'mastodon/features/settings/setting_widgets';
import { applyPersonalAppearance } from 'mastodon/utils/personal_appearance';

// Appearance & language section (settings rebuild §7). The schema and current
// values come from the server (/api/v1/settings/appearance); this page renders
// them with the shared settings widgets and autosaves each change. Field
// labels live here (frontend i18n) rather than on the server.

const messages = defineMessages({
  title: {
    id: 'appearance_settings.title',
    defaultMessage: 'Appearance & language',
  },
  intro: {
    id: 'appearance_settings.intro',
    defaultMessage: 'Theme, language, and the defaults for what you post.',
  },
  saving: { id: 'appearance_settings.saving', defaultMessage: 'Saving…' },
  saved: { id: 'appearance_settings.saved', defaultMessage: 'Saved' },
  error: { id: 'appearance_settings.error', defaultMessage: 'Couldn’t save' },

  theme: { id: 'appearance_settings.theme', defaultMessage: 'Theme' },
  interfaceLanguage: {
    id: 'appearance_settings.interface_language',
    defaultMessage: 'Interface language',
  },
  defaultPrivacy: {
    id: 'appearance_settings.default_privacy',
    defaultMessage: 'Default post visibility',
  },
  defaultLanguage: {
    id: 'appearance_settings.default_language',
    defaultMessage: 'Default posting language',
  },
  defaultSensitive: {
    id: 'appearance_settings.default_sensitive',
    defaultMessage: 'Mark media as sensitive by default',
  },
  reduceMotion: {
    id: 'appearance_settings.reduce_motion',
    defaultMessage: 'Reduce motion',
  },
  autoPlayGif: {
    id: 'appearance_settings.auto_play_gif',
    defaultMessage: 'Auto-play animations',
  },

  reduceMotionHint: {
    id: 'appearance_settings.reduce_motion_hint',
    defaultMessage: 'Minimise non-essential animation across the app.',
  },
  defaultPrivacyHint: {
    id: 'appearance_settings.default_privacy_hint',
    defaultMessage: 'Who can see new posts, before you change it per post.',
  },

  personalAccent: {
    id: 'appearance_settings.personal_accent',
    defaultMessage: 'Accent colour',
  },
  personalAccentHint: {
    id: 'appearance_settings.personal_accent_hint',
    defaultMessage:
      'Your personal purple. Everyone picks their own shade — it always stays in the Kronk family.',
  },
  personalFontDisplay: {
    id: 'appearance_settings.personal_font_display',
    defaultMessage: 'Display font',
  },
  personalFontBody: {
    id: 'appearance_settings.personal_font_body',
    defaultMessage: 'Body font',
  },
  uiScale: {
    id: 'appearance_settings.ui_scale',
    defaultMessage: 'Interface size',
  },
  uiScaleHint: {
    id: 'appearance_settings.ui_scale_hint',
    defaultMessage: 'Scale the whole interface up or down.',
  },
});

const LABELS: Record<string, MessageDescriptor> = {
  theme: messages.theme,
  interface_language: messages.interfaceLanguage,
  default_privacy: messages.defaultPrivacy,
  default_language: messages.defaultLanguage,
  default_sensitive: messages.defaultSensitive,
  reduce_motion: messages.reduceMotion,
  auto_play_gif: messages.autoPlayGif,
  personal_accent: messages.personalAccent,
  personal_font_display: messages.personalFontDisplay,
  personal_font_body: messages.personalFontBody,
  ui_scale: messages.uiScale,
};

const HINTS: Record<string, MessageDescriptor> = {
  reduce_motion: messages.reduceMotionHint,
  default_privacy: messages.defaultPrivacyHint,
  personal_accent: messages.personalAccentHint,
  ui_scale: messages.uiScaleHint,
};

// Apply the appearance-affecting subset of the settings map to the DOM live.
const previewAppearance = (vals: Record<string, unknown>) => {
  applyPersonalAppearance({
    accent: (vals.personal_accent as string) || null,
    fontDisplay: (vals.personal_font_display as string) || null,
    fontBody: (vals.personal_font_body as string) || null,
    uiScale: (vals.ui_scale as string) || null,
  });
};

interface AppearancePayload {
  settings_schema: SettingDescriptor[];
  values: Record<string, unknown>;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export const AppearanceSettings: React.FC<{ multiColumn?: boolean }> = ({
  multiColumn,
}) => {
  const intl = useIntl();
  const [schema, setSchema] = useState<SettingDescriptor[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<SaveStatus>('idle');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiRequestGet<AppearancePayload>(
          'v1/settings/appearance',
        );
        if (!cancelled) {
          setSchema(res.settings_schema);
          setValues(res.values);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(
    async (name: string, value: unknown) => {
      const previous = values[name];
      setValues((v) => ({ ...v, [name]: value }));
      previewAppearance({ ...values, [name]: value }); // live preview
      setStatus('saving');
      try {
        const res = await apiRequestPut<AppearancePayload>(
          'v1/settings/appearance',
          { [name]: value },
        );
        setValues(res.values);
        previewAppearance(res.values); // reconcile with server-validated values
        setStatus('saved');
      } catch {
        setValues((v) => ({ ...v, [name]: previous }));
        previewAppearance({ ...values, [name]: previous }); // revert preview
        setStatus('error');
      }
    },
    [values],
  );

  const handleSet = useCallback(
    (name: string, value: unknown) => { void save(name, value); },
    [save],
  );

  const statusLabel =
    status === 'saving'
      ? intl.formatMessage(messages.saving)
      : status === 'saved'
        ? intl.formatMessage(messages.saved)
        : status === 'error'
          ? intl.formatMessage(messages.error)
          : '';

  return (
    <Column>
      <ColumnHeader
        title={intl.formatMessage(messages.title)}
        icon='tune'
        iconComponent={TuneIcon}
        multiColumn={multiColumn}
        showBackButton
      />

      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <div className='scrollable appearance-settings'>
        <header className='appearance-settings__hero'>
          <span className='appearance-settings__hero-glyph' aria-hidden='true'>
            <TuneIcon />
          </span>
          <div>
            <h1 className='appearance-settings__hero-title'>
              {intl.formatMessage(messages.title)}
            </h1>
            <p className='appearance-settings__hero-intro'>
              {intl.formatMessage(messages.intro)}
            </p>
          </div>
          <span
            className={`appearance-settings__status appearance-settings__status--${status}`}
            role='status'
          >
            {statusLabel}
          </span>
        </header>

        {loaded && (
          <div className='appearance-settings__fields'>
            {schema.map((setting) => {
              const labelMsg = LABELS[setting.name];
              const hintMsg = HINTS[setting.name];
              return (
                <NamedSettingRow
                  key={setting.name}
                  setting={{
                    ...setting,
                    label: labelMsg ? intl.formatMessage(labelMsg) : undefined,
                    description: hintMsg
                      ? intl.formatMessage(hintMsg)
                      : undefined,
                  }}
                  value={values[setting.name]}
                  onSet={handleSet}
                />
              );
            })}
          </div>
        )}
      </div>
    </Column>
  );
};

