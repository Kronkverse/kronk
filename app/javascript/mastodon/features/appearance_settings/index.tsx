/* eslint-disable @typescript-eslint/no-unnecessary-condition --
 * `cancelled` mutates in the useEffect cleanup after the async fetch
 * reads it. TS control-flow doesn't track the mutation across the
 * closure so the checks look "always truthy/falsy", but the guards
 * are load-bearing: without them setState fires after unmount. */

import { useEffect, useState, useCallback, useMemo } from 'react';

import { defineMessages, useIntl } from 'react-intl';
import type { MessageDescriptor } from 'react-intl';

import { apiRequestGet, apiRequestPut } from 'mastodon/api';
import {
  SettingsPage,
  SettingsSection,
} from 'mastodon/features/settings/components';
import type { SaveStatus } from 'mastodon/features/settings/components';
import { NamedSettingRow } from 'mastodon/features/settings/setting_widgets';
import type { SettingDescriptor } from 'mastodon/features/settings/setting_widgets';
import { applyPersonalAppearance } from 'mastodon/utils/personal_appearance';

// Appearance & language settings. Migrated 2026-09-12 onto the shared
// <SettingsPage> / <SettingsSection> primitives so it reads as one of
// the standardised /settings/* surfaces rather than its own thing.
// Fields cluster into logical groups (Theme & colour, Fonts & scale,
// Motion, Language) instead of the previous flat list.

const messages = defineMessages({
  title: {
    id: 'appearance_settings.title',
    defaultMessage: 'Appearance & language',
  },
  intro: {
    id: 'appearance_settings.intro',
    defaultMessage: 'Theme, fonts, and how Kronk looks and feels to you.',
  },

  sectionThemeTitle: {
    id: 'appearance_settings.section.theme',
    defaultMessage: 'Theme & colour',
  },
  sectionThemeDesc: {
    id: 'appearance_settings.section.theme_desc',
    defaultMessage:
      'The overall theme and your personal shade of Kronk-purple.',
  },
  sectionFontsTitle: {
    id: 'appearance_settings.section.fonts',
    defaultMessage: 'Fonts & scale',
  },
  sectionFontsDesc: {
    id: 'appearance_settings.section.fonts_desc',
    defaultMessage: 'Type stacks and interface size.',
  },
  sectionMotionTitle: {
    id: 'appearance_settings.section.motion',
    defaultMessage: 'Motion',
  },
  sectionLanguageTitle: {
    id: 'appearance_settings.section.language',
    defaultMessage: 'Language',
  },

  theme: { id: 'appearance_settings.theme', defaultMessage: 'Theme' },
  interfaceLanguage: {
    id: 'appearance_settings.interface_language',
    defaultMessage: 'Interface language',
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

  personalAccent: {
    id: 'appearance_settings.personal_accent',
    defaultMessage: 'Accent colour',
  },
  personalAccentHint: {
    id: 'appearance_settings.personal_accent_hint',
    defaultMessage:
      'Your personal purple. Everyone picks their own shade — it always stays in the Kronk family.',
  },
  personalPurpleHue: {
    id: 'appearance_settings.personal_purple_hue',
    defaultMessage: 'Purple hue',
  },
  personalPurpleHueHint: {
    id: 'appearance_settings.personal_purple_hue_hint',
    defaultMessage:
      'Slide to warm or cool the whole purple family together. Everything (accents, borders, glyphs) rotates as one so nothing drifts out of the Kronk aesthetic.',
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
  reduce_motion: messages.reduceMotion,
  auto_play_gif: messages.autoPlayGif,
  personal_accent: messages.personalAccent,
  personal_purple_hue: messages.personalPurpleHue,
  personal_font_display: messages.personalFontDisplay,
  personal_font_body: messages.personalFontBody,
  ui_scale: messages.uiScale,
};

const HINTS: Record<string, MessageDescriptor> = {
  reduce_motion: messages.reduceMotionHint,
  personal_accent: messages.personalAccentHint,
  personal_purple_hue: messages.personalPurpleHueHint,
  ui_scale: messages.uiScaleHint,
};

// Which fields go in which section. Any field the server ships that
// isn't listed here falls into `other` at the bottom — belt-and-
// braces so a new setting doesn't just vanish from the UI.
const SECTIONS = [
  {
    key: 'theme',
    titleMsg: messages.sectionThemeTitle,
    descMsg: messages.sectionThemeDesc,
    fields: ['theme', 'personal_accent', 'personal_purple_hue'],
  },
  {
    key: 'fonts',
    titleMsg: messages.sectionFontsTitle,
    descMsg: messages.sectionFontsDesc,
    fields: ['personal_font_display', 'personal_font_body', 'ui_scale'],
  },
  {
    key: 'motion',
    titleMsg: messages.sectionMotionTitle,
    descMsg: null,
    fields: ['reduce_motion', 'auto_play_gif'],
  },
  {
    key: 'language',
    titleMsg: messages.sectionLanguageTitle,
    descMsg: null,
    fields: ['interface_language'],
  },
] as const;

// Apply the appearance-affecting subset of the settings map to the DOM live.
const previewAppearance = (vals: Record<string, unknown>) => {
  // personal_purple_hue may arrive as a number (fresh from the slider)
  // or as a string (round-tripped through UserSettings — see the note
  // in HueWidget). Coerce here so applyPurpleHue always sees a number
  // or null.
  const rawHue = vals.personal_purple_hue;
  const purpleHue =
    typeof rawHue === 'number' && Number.isFinite(rawHue)
      ? rawHue
      : typeof rawHue === 'string' && rawHue.trim() !== ''
        ? Number(rawHue)
        : null;

  applyPersonalAppearance({
    accent: (vals.personal_accent as string) || null,
    purpleHue:
      purpleHue !== null && Number.isFinite(purpleHue) ? purpleHue : null,
    fontDisplay: (vals.personal_font_display as string) || null,
    fontBody: (vals.personal_font_body as string) || null,
    uiScale: (vals.ui_scale as string) || null,
  });
};

interface AppearancePayload {
  settings_schema: SettingDescriptor[];
  values: Record<string, unknown>;
}

export const AppearanceSettings: React.FC<{ multiColumn?: boolean }> = () => {
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
    (name: string, value: unknown) => {
      void save(name, value);
    },
    [save],
  );

  // Bucket the schema by section. Anything the server ships that
  // isn't listed in SECTIONS ends up in an unnamed "other" bucket at
  // the bottom, so new server-side additions don't silently vanish.
  const bySection = useMemo(() => {
    const map = new Map<string, SettingDescriptor[]>();
    for (const s of SECTIONS) map.set(s.key, []);
    map.set('other', []);
    for (const setting of schema) {
      const section = SECTIONS.find((s) =>
        (s.fields as readonly string[]).includes(setting.name),
      );
      const key: string = section?.key ?? 'other';
      map.get(key)?.push(setting);
    }
    return map;
  }, [schema]);

  const renderSetting = useCallback(
    (setting: SettingDescriptor) => {
      const labelMsg = LABELS[setting.name];
      const hintMsg = HINTS[setting.name];
      return (
        <NamedSettingRow
          key={setting.name}
          setting={{
            ...setting,
            label: labelMsg ? intl.formatMessage(labelMsg) : undefined,
            description: hintMsg ? intl.formatMessage(hintMsg) : undefined,
          }}
          value={values[setting.name]}
          onSet={handleSet}
        />
      );
    },
    [intl, values, handleSet],
  );

  return (
    <SettingsPage
      title={intl.formatMessage(messages.title)}
      tagline={intl.formatMessage(messages.intro)}
      status={status}
    >
      {loaded &&
        SECTIONS.map((section) => {
          const items = bySection.get(section.key) ?? [];
          if (items.length === 0) return null;
          return (
            <SettingsSection
              key={section.key}
              title={intl.formatMessage(section.titleMsg)}
              description={
                section.descMsg
                  ? intl.formatMessage(section.descMsg)
                  : undefined
              }
            >
              {items.map(renderSetting)}
            </SettingsSection>
          );
        })}
      {loaded && (bySection.get('other')?.length ?? 0) > 0 && (
        <SettingsSection title='Other' hideTitle>
          {(bySection.get('other') ?? []).map(renderSetting)}
        </SettingsSection>
      )}
    </SettingsPage>
  );
};
