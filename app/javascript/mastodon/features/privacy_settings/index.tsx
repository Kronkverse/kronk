/* eslint-disable @typescript-eslint/no-unnecessary-condition --
 * `cancelled` mutates in the useEffect cleanup after the async fetch
 * reads it. TS control-flow doesn't track the mutation across the
 * closure so the checks look "always truthy/falsy", but the guards
 * are load-bearing: without them setState fires after unmount. */

import { useEffect, useState, useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';
import type { MessageDescriptor } from 'react-intl';

import { Helmet } from 'react-helmet';

import { apiRequestGet, apiRequestPut, apiRequestPost } from 'mastodon/api';
import { Stage } from 'mastodon/components/stage';
import { ListManager } from 'mastodon/features/settings/list_manager';
import { NamedSettingRow } from 'mastodon/features/settings/setting_widgets';
import type { SettingDescriptor } from 'mastodon/features/settings/setting_widgets';

// Privacy section (settings rebuild §7). Toggles (follow-approval,
// discoverability, DM gate) come from /api/v1/settings/privacy and render
// through the shared widgets; the muted/blocked account lists use the
// generic ListManager wired to the existing Mastodon list endpoints.
// (Filters + blocked domains land in a follow-up.) Reuses the
// appearance-settings section chrome classes.

interface ListAccount {
  id: string;
  acct: string;
  display_name: string;
  avatar: string;
}

// Module-level accessors so they aren't inline arrows in JSX (jsx-no-bind).
const accountKey = (a: ListAccount) => a.id;
const accountPrimary = (a: ListAccount) => a.display_name || a.acct;
const accountSecondary = (a: ListAccount) => `@${a.acct}`;
const accountAvatar = (a: ListAccount) => a.avatar;
const unmuteAccount = (a: ListAccount) =>
  apiRequestPost(`v1/accounts/${a.id}/unmute`);
const unblockAccount = (a: ListAccount) =>
  apiRequestPost(`v1/accounts/${a.id}/unblock`);

const messages = defineMessages({
  title: { id: 'privacy_settings.title', defaultMessage: 'Privacy' },
  intro: {
    id: 'privacy_settings.intro',
    defaultMessage: 'Who can reach you, and who can find you.',
  },
  saving: { id: 'privacy_settings.saving', defaultMessage: 'Saving…' },
  saved: { id: 'privacy_settings.saved', defaultMessage: 'Saved' },
  error: { id: 'privacy_settings.error', defaultMessage: 'Couldn’t save' },

  locked: {
    id: 'privacy_settings.locked',
    defaultMessage: 'Require follow approval',
  },
  lockedHint: {
    id: 'privacy_settings.locked_hint',
    defaultMessage:
      'New followers must be approved before they can follow you.',
  },
  discoverable: {
    id: 'privacy_settings.discoverable',
    defaultMessage: 'Discoverable',
  },
  discoverableHint: {
    id: 'privacy_settings.discoverable_hint',
    defaultMessage: 'Show up in the directory, search, and follow suggestions.',
  },
  indexable: {
    id: 'privacy_settings.indexable',
    defaultMessage: 'Include posts in search engines',
  },
  indexableHint: {
    id: 'privacy_settings.indexable_hint',
    defaultMessage:
      'Let external search engines (Google, etc.) index your public posts.',
  },
  hideCollections: {
    id: 'privacy_settings.hide_collections',
    defaultMessage: 'Hide followers and follows',
  },
  hideCollectionsHint: {
    id: 'privacy_settings.hide_collections_hint',
    defaultMessage:
      'Keep your follower and following lists off your public profile.',
  },
  showApplication: {
    id: 'privacy_settings.show_application',
    defaultMessage: 'Show which app I used to post',
  },
  showApplicationHint: {
    id: 'privacy_settings.show_application_hint',
    defaultMessage:
      'Reveal the client name (web, mobile app, third-party) alongside each post.',
  },
  dmFollowersOnly: {
    id: 'privacy_settings.dm_followers_only',
    defaultMessage: 'Only people you follow can message you',
  },

  mutedTitle: {
    id: 'privacy_settings.muted',
    defaultMessage: 'Muted accounts',
  },
  mutedEmpty: {
    id: 'privacy_settings.muted_empty',
    defaultMessage: 'You haven’t muted anyone.',
  },
  unmute: { id: 'privacy_settings.unmute', defaultMessage: 'Unmute' },
  blockedTitle: {
    id: 'privacy_settings.blocked',
    defaultMessage: 'Blocked accounts',
  },
  blockedEmpty: {
    id: 'privacy_settings.blocked_empty',
    defaultMessage: 'You haven’t blocked anyone.',
  },
  unblock: { id: 'privacy_settings.unblock', defaultMessage: 'Unblock' },
});

const LABELS: Record<string, MessageDescriptor> = {
  locked: messages.locked,
  discoverable: messages.discoverable,
  indexable: messages.indexable,
  hide_collections: messages.hideCollections,
  show_application: messages.showApplication,
  dm_followers_only: messages.dmFollowersOnly,
};

const HINTS: Record<string, MessageDescriptor> = {
  locked: messages.lockedHint,
  discoverable: messages.discoverableHint,
  indexable: messages.indexableHint,
  hide_collections: messages.hideCollectionsHint,
  show_application: messages.showApplicationHint,
};

interface PrivacyPayload {
  settings_schema: SettingDescriptor[];
  values: Record<string, unknown>;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export const PrivacySettings: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const [schema, setSchema] = useState<SettingDescriptor[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<SaveStatus>('idle');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiRequestGet<PrivacyPayload>('v1/settings/privacy');
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
        const res = await apiRequestPut<PrivacyPayload>('v1/settings/privacy', {
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

  const statusLabel =
    status === 'saving'
      ? intl.formatMessage(messages.saving)
      : status === 'saved'
        ? intl.formatMessage(messages.saved)
        : status === 'error'
          ? intl.formatMessage(messages.error)
          : '';

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <div className='scrollable appearance-settings'>
        <header className='space-header' data-frame-header=''>
          <h1 className='space-header__title'>
            {intl.formatMessage(messages.title)}
          </h1>
          <p className='space-header__tagline'>
            {intl.formatMessage(messages.intro)}
          </p>
        </header>

        <div className='appearance-settings__status-row'>
          <span
            className={`appearance-settings__status appearance-settings__status--${status}`}
            role='status'
          >
            {statusLabel}
          </span>
        </div>

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

        <div className='appearance-settings__fields'>
          <ListManager<ListAccount>
            title={intl.formatMessage(messages.mutedTitle)}
            emptyMessage={intl.formatMessage(messages.mutedEmpty)}
            fetchUrl='v1/mutes'
            getKey={accountKey}
            primary={accountPrimary}
            secondary={accountSecondary}
            avatar={accountAvatar}
            removeItem={unmuteAccount}
            removeLabel={intl.formatMessage(messages.unmute)}
          />
          <ListManager<ListAccount>
            title={intl.formatMessage(messages.blockedTitle)}
            emptyMessage={intl.formatMessage(messages.blockedEmpty)}
            fetchUrl='v1/blocks'
            getKey={accountKey}
            primary={accountPrimary}
            secondary={accountSecondary}
            avatar={accountAvatar}
            removeItem={unblockAccount}
            removeLabel={intl.formatMessage(messages.unblock)}
          />
        </div>
      </div>
    </Stage>
  );
};
