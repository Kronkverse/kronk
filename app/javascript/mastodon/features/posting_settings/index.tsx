import { useEffect, useState, useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';
import type { MessageDescriptor } from 'react-intl';

import { Helmet } from 'react-helmet';

import EditNoteIcon from '@/material-icons/400-24px/edit_note.svg?react';
import { apiRequestGet, apiRequestPut } from 'mastodon/api';
import Column from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { SettingRow } from 'mastodon/features/settings/setting_widgets';
import type { SettingDescriptor } from 'mastodon/features/settings/setting_widgets';

// Posting defaults section (settings rebuild §7; settings.posting). The
// defaults applied when you compose a post. Schema + values come from the
// server (/api/v1/settings/posting); rendered with the shared settings widgets
// and autosaved per change. See docs/kronk_settings_ia.md.

const messages = defineMessages({
  title: { id: 'posting_settings.title', defaultMessage: 'Posting' },
  intro: {
    id: 'posting_settings.intro',
    defaultMessage: 'The defaults applied when you compose a new post.',
  },
  saving: { id: 'posting_settings.saving', defaultMessage: 'Saving…' },
  saved: { id: 'posting_settings.saved', defaultMessage: 'Saved' },
  error: { id: 'posting_settings.error', defaultMessage: 'Couldn’t save' },

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

const LABELS: Record<string, MessageDescriptor> = {
  default_privacy: messages.defaultPrivacy,
  default_language: messages.defaultLanguage,
  default_sensitive: messages.defaultSensitive,
};

const HINTS: Record<string, MessageDescriptor> = {
  default_privacy: messages.defaultPrivacyHint,
};

interface PostingPayload {
  settings_schema: SettingDescriptor[];
  values: Record<string, unknown>;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export const PostingSettings: React.FC<{ multiColumn?: boolean }> = ({
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
        icon='edit_note'
        iconComponent={EditNoteIcon}
        multiColumn={multiColumn}
        showBackButton
      />

      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <div className='scrollable appearance-settings'>
        <header className='appearance-settings__hero'>
          <span className='appearance-settings__hero-glyph' aria-hidden='true'>
            <EditNoteIcon />
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
                <SettingRow
                  key={setting.name}
                  setting={{
                    ...setting,
                    label: labelMsg ? intl.formatMessage(labelMsg) : undefined,
                    description: hintMsg
                      ? intl.formatMessage(hintMsg)
                      : undefined,
                  }}
                  value={values[setting.name]}
                  onChange={(value) => void save(setting.name, value)}
                />
              );
            })}
          </div>
        )}
      </div>
    </Column>
  );
};

export default PostingSettings;
