/* eslint-disable @typescript-eslint/no-unnecessary-condition --
 * `cancelled` mutates in the useEffect cleanup after the async fetch
 * reads it. TS control-flow doesn't track the mutation across the
 * closure so the checks look "always truthy/falsy", but the guards
 * are load-bearing: without them setState fires after unmount. */

import { useEffect, useState, useCallback } from 'react';

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

// Posting defaults. Only three fields, so a single section wrapper
// keeps the visual weight matched with the other settings pages
// (rather than a bare list floating on the page).

const messages = defineMessages({
  title: { id: 'posting_settings.title', defaultMessage: 'Posting' },
  intro: {
    id: 'posting_settings.intro',
    defaultMessage: 'The defaults applied when you compose a new post.',
  },
  sectionTitle: {
    id: 'posting_settings.section.defaults',
    defaultMessage: 'Defaults',
  },

  defaultPrivacy: {
    id: 'posting_settings.default_privacy',
    defaultMessage: 'Default post visibility',
  },
  defaultPrivacyHint: {
    id: 'posting_settings.default_privacy_hint',
    defaultMessage: 'Who can see new posts, before you change it per post.',
  },
  defaultLanguage: {
    id: 'posting_settings.default_language',
    defaultMessage: 'Default posting language',
  },
  defaultSensitive: {
    id: 'posting_settings.default_sensitive',
    defaultMessage: 'Mark media as sensitive by default',
  },
});

const LABELS: Record<string, MessageDescriptor | undefined> = {
  default_privacy: messages.defaultPrivacy,
  default_language: messages.defaultLanguage,
  default_sensitive: messages.defaultSensitive,
};

const HINTS: Record<string, MessageDescriptor | undefined> = {
  default_privacy: messages.defaultPrivacyHint,
};

interface PostingPayload {
  settings_schema: SettingDescriptor[];
  values: Record<string, unknown>;
}

export const PostingSettings: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const [schema, setSchema] = useState<SettingDescriptor[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<SaveStatus>('idle');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiRequestGet<PostingPayload>('v1/settings/posting');
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
      setStatus('saving');
      try {
        const res = await apiRequestPut<PostingPayload>('v1/settings/posting', {
          [name]: value,
        });
        setValues(res.values);
        setStatus('saved');
      } catch {
        setValues((v) => ({ ...v, [name]: previous }));
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

  return (
    <SettingsPage
      title={intl.formatMessage(messages.title)}
      tagline={intl.formatMessage(messages.intro)}
      status={status}
    >
      {loaded && schema.length > 0 && (
        <SettingsSection title={intl.formatMessage(messages.sectionTitle)}>
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
        </SettingsSection>
      )}
    </SettingsPage>
  );
};

// eslint-disable-next-line import/no-default-export
export default PostingSettings;
