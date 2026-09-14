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
  SettingsRow,
  SettingsSection,
} from 'mastodon/features/settings/components';
import type { SaveStatus } from 'mastodon/features/settings/components';
import {
  BooleanWidget,
  EnumWidget,
  NamedSettingRow,
} from 'mastodon/features/settings/setting_widgets';
import type { SettingDescriptor } from 'mastodon/features/settings/setting_widgets';

// Posting concerns. Two sub-surfaces:
//   1. Defaults for new posts (visibility, language, sensitive) —
//      backed by /api/v1/settings/posting.
//   2. Automated post deletion — backed by
//      /api/v1/settings/statuses_cleanup, the SPA face of
//      AccountStatusesCleanupPolicy. Migrated 2026-09-14 from the
//      classic /statuses_cleanup Rails page (settings inventory
//      "still open"). Fields render manually because min_favs /
//      min_reblogs are nullable "no minimum" integers that the
//      shared NumberInput can't express (empty coerces to 0).

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

  cleanupSectionTitle: {
    id: 'posting_settings.section.cleanup',
    defaultMessage: 'Automated post deletion',
  },
  cleanupSectionDesc: {
    id: 'posting_settings.section.cleanup_desc',
    defaultMessage:
      'Have Kronk quietly delete your older posts on a schedule. Exceptions below let you keep the ones that still matter.',
  },
  cleanupEnabled: {
    id: 'posting_settings.cleanup.enabled',
    defaultMessage: 'Automatically delete old posts',
  },
  cleanupMinAge: {
    id: 'posting_settings.cleanup.min_age',
    defaultMessage: 'Delete posts older than',
  },
  cleanupExceptionsTitle: {
    id: 'posting_settings.cleanup.exceptions_title',
    defaultMessage: 'Keep even old posts that\u2026',
  },
  cleanupKeepDirect: {
    id: 'posting_settings.cleanup.keep_direct',
    defaultMessage: 'are direct messages',
  },
  cleanupKeepPinned: {
    id: 'posting_settings.cleanup.keep_pinned',
    defaultMessage: 'are pinned',
  },
  cleanupKeepPolls: {
    id: 'posting_settings.cleanup.keep_polls',
    defaultMessage: 'are polls',
  },
  cleanupKeepMedia: {
    id: 'posting_settings.cleanup.keep_media',
    defaultMessage: 'have media attached',
  },
  cleanupKeepSelfFav: {
    id: 'posting_settings.cleanup.keep_self_fav',
    defaultMessage: 'you frothed yourself',
  },
  cleanupKeepSelfBookmark: {
    id: 'posting_settings.cleanup.keep_self_bookmark',
    defaultMessage: 'you bookmarked',
  },
  cleanupMinFavs: {
    id: 'posting_settings.cleanup.min_favs',
    defaultMessage: 'Minimum froths to keep a post',
  },
  cleanupMinReblogs: {
    id: 'posting_settings.cleanup.min_reblogs',
    defaultMessage: 'Minimum boosts to keep a post',
  },
  cleanupNoMinimum: {
    id: 'posting_settings.cleanup.no_minimum',
    defaultMessage: 'No minimum',
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

interface CleanupPayload {
  enabled: boolean;
  min_status_age: number;
  keep_direct: boolean;
  keep_pinned: boolean;
  keep_polls: boolean;
  keep_media: boolean;
  keep_self_fav: boolean;
  keep_self_bookmark: boolean;
  min_favs: number | null;
  min_reblogs: number | null;
  min_status_age_options: number[];
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

      <CleanupSection onStatus={setStatus} />
    </SettingsPage>
  );
};

// Automated post deletion — its own fetch, its own PUT. Kept separate
// from the defaults endpoint because it writes through an ActiveRecord
// policy row with its own validation (whitelist of eight age windows,
// nullable "no minimum" thresholds), not the user_settings hash.
const CleanupSection: React.FC<{
  onStatus: (s: SaveStatus) => void;
}> = ({ onStatus }) => {
  const intl = useIntl();
  const [state, setState] = useState<CleanupPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiRequestGet<CleanupPayload>(
          'v1/settings/statuses_cleanup',
        );
        if (!cancelled) setState(res);
      } catch {
        // Fetch fail leaves the section unrendered rather than half-baked.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(
    async (patch: Partial<CleanupPayload>) => {
      if (!state) return;
      const previous = state;
      setState({ ...state, ...patch });
      onStatus('saving');
      try {
        const res = await apiRequestPut<CleanupPayload>(
          'v1/settings/statuses_cleanup',
          patch,
        );
        setState(res);
        onStatus('saved');
      } catch {
        setState(previous);
        onStatus('error');
      }
    },
    [state, onStatus],
  );

  const setBool = useCallback(
    (key: keyof CleanupPayload) => (v: boolean) => {
      void save({ [key]: v } as Partial<CleanupPayload>);
    },
    [save],
  );

  const setMinAge = useCallback(
    (v: string) => {
      void save({ min_status_age: Number(v) });
    },
    [save],
  );

  const setThreshold = useCallback(
    (key: 'min_favs' | 'min_reblogs') =>
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const raw = event.currentTarget.value.trim();
        // Empty (or 0) reads as "no minimum" \u2014 null on the wire.
        // The policy validates >= 1 when present, so we never send 0.
        const next = raw === '' ? null : Number(raw);
        if (next !== null && !Number.isFinite(next)) return;
        void save({ [key]: next } as Partial<CleanupPayload>);
      },
    [save],
  );

  if (!state) return null;

  return (
    <SettingsSection
      title={intl.formatMessage(messages.cleanupSectionTitle)}
      description={intl.formatMessage(messages.cleanupSectionDesc)}
    >
      <SettingsRow label={intl.formatMessage(messages.cleanupEnabled)}>
        <BooleanWidget
          value={state.enabled}
          onChange={setBool('enabled')}
          ariaLabel={intl.formatMessage(messages.cleanupEnabled)}
        />
      </SettingsRow>

      <SettingsRow label={intl.formatMessage(messages.cleanupMinAge)}>
        <EnumWidget
          options={state.min_status_age_options.map(String)}
          value={String(state.min_status_age)}
          onChange={setMinAge}
        />
      </SettingsRow>

      <SettingsRow
        label={intl.formatMessage(messages.cleanupExceptionsTitle)}
        stack
      >
        <>
          <ExceptionRow
            label={intl.formatMessage(messages.cleanupKeepDirect)}
            checked={state.keep_direct}
            onChange={setBool('keep_direct')}
          />
          <ExceptionRow
            label={intl.formatMessage(messages.cleanupKeepPinned)}
            checked={state.keep_pinned}
            onChange={setBool('keep_pinned')}
          />
          <ExceptionRow
            label={intl.formatMessage(messages.cleanupKeepPolls)}
            checked={state.keep_polls}
            onChange={setBool('keep_polls')}
          />
          <ExceptionRow
            label={intl.formatMessage(messages.cleanupKeepMedia)}
            checked={state.keep_media}
            onChange={setBool('keep_media')}
          />
          <ExceptionRow
            label={intl.formatMessage(messages.cleanupKeepSelfFav)}
            checked={state.keep_self_fav}
            onChange={setBool('keep_self_fav')}
          />
          <ExceptionRow
            label={intl.formatMessage(messages.cleanupKeepSelfBookmark)}
            checked={state.keep_self_bookmark}
            onChange={setBool('keep_self_bookmark')}
          />
        </>
      </SettingsRow>

      <SettingsRow
        label={intl.formatMessage(messages.cleanupMinFavs)}
        description={intl.formatMessage(messages.cleanupNoMinimum)}
      >
        <input
          type='number'
          min={1}
          value={state.min_favs ?? ''}
          onChange={setThreshold('min_favs')}
          placeholder={intl.formatMessage(messages.cleanupNoMinimum)}
        />
      </SettingsRow>

      <SettingsRow
        label={intl.formatMessage(messages.cleanupMinReblogs)}
        description={intl.formatMessage(messages.cleanupNoMinimum)}
      >
        <input
          type='number'
          min={1}
          value={state.min_reblogs ?? ''}
          onChange={setThreshold('min_reblogs')}
          placeholder={intl.formatMessage(messages.cleanupNoMinimum)}
        />
      </SettingsRow>
    </SettingsSection>
  );
};

// Local wrapper so the six exception rows share one checkbox+label
// layout and get a stable per-row callback identity in the parent's
// `<>` fragment (react/jsx-no-bind).
const ExceptionRow: React.FC<{
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, checked, onChange }) => {
  const handleChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      onChange(e.currentTarget.checked);
    },
    [onChange],
  );
  return (
    <label className='korner-settings__multi-item'>
      <input type='checkbox' checked={checked} onChange={handleChange} />
      <span>{label}</span>
    </label>
  );
};

// eslint-disable-next-line import/no-default-export
export default PostingSettings;
