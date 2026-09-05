/* eslint-disable @typescript-eslint/no-unnecessary-condition --
 * `cancelled` mutates in the useEffect cleanup after the async fetch
 * reads it. TS control-flow doesn't track the mutation across the
 * closure so the checks look "always truthy/falsy", but the guards
 * are load-bearing: without them setState fires after unmount. */

import { useEffect, useState, useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';
import type { MessageDescriptor } from 'react-intl';

import { Helmet } from 'react-helmet';

import { apiRequestGet, apiRequestPut } from 'mastodon/api';
import { AllSettingsFooter } from 'mastodon/components/all_settings_footer';
import { Stage } from 'mastodon/components/stage';
import { NamedSettingRow } from 'mastodon/features/settings/setting_widgets';
import type { SettingDescriptor } from 'mastodon/features/settings/setting_widgets';
import { SettingsSpaceHeader } from 'mastodon/features/settings/space_header';

// Notifications section (settings rebuild §7). Schema + values come from the
// server (/api/v1/settings/notifications); rendered with the shared settings
// widgets, autosaves each change. Reuses the appearance-settings section
// chrome classes (shared page frame — rename to a neutral class in cleanup).

const messages = defineMessages({
  title: {
    id: 'notifications_settings.title',
    defaultMessage: 'Notifications',
  },
  intro: {
    id: 'notifications_settings.intro',
    defaultMessage:
      'Which activity reaches you by email. In-app notices live in Nudges.',
  },
  saving: { id: 'notifications_settings.saving', defaultMessage: 'Saving…' },
  saved: { id: 'notifications_settings.saved', defaultMessage: 'Saved' },
  error: {
    id: 'notifications_settings.error',
    defaultMessage: 'Couldn’t save',
  },

  alwaysSendEmails: {
    id: 'notifications_settings.always_send_emails',
    defaultMessage: 'Email me even when I’m active',
  },
  alwaysSendEmailsHint: {
    id: 'notifications_settings.always_send_emails_hint',
    defaultMessage:
      'By default, emails pause while you’re using Kronk. Turn this on to receive them regardless.',
  },
  emailMention: {
    id: 'notifications_settings.email_mention',
    defaultMessage: 'Email me on mentions',
  },
  emailFollow: {
    id: 'notifications_settings.email_follow',
    defaultMessage: 'Email me on new followers',
  },
  emailFollowRequest: {
    id: 'notifications_settings.email_follow_request',
    defaultMessage: 'Email me on follow requests',
  },
  emailReblog: {
    id: 'notifications_settings.email_reblog',
    defaultMessage: 'Email me on boosts',
  },
  emailFavourite: {
    id: 'notifications_settings.email_favourite',
    defaultMessage: 'Email me on favourites',
  },
  emailQuote: {
    id: 'notifications_settings.email_quote',
    defaultMessage: 'Email me on quotes',
  },
  emailEventInvitation: {
    id: 'notifications_settings.email_event_invitation',
    defaultMessage: 'Email me on event invitations',
  },
  emailSoftwareUpdates: {
    id: 'notifications_settings.email_software_updates',
    defaultMessage: 'Server update emails',
  },
  emailSoftwareUpdatesHint: {
    id: 'notifications_settings.email_software_updates_hint',
    defaultMessage: 'Which server update announcements get emailed to you.',
  },
});

const LABELS: Record<string, MessageDescriptor> = {
  always_send_emails: messages.alwaysSendEmails,
  email_mention: messages.emailMention,
  email_follow: messages.emailFollow,
  email_follow_request: messages.emailFollowRequest,
  email_reblog: messages.emailReblog,
  email_favourite: messages.emailFavourite,
  email_quote: messages.emailQuote,
  email_event_invitation: messages.emailEventInvitation,
  email_software_updates: messages.emailSoftwareUpdates,
};

const HINTS: Record<string, MessageDescriptor> = {
  always_send_emails: messages.alwaysSendEmailsHint,
  email_software_updates: messages.emailSoftwareUpdatesHint,
};

interface NotificationsPayload {
  settings_schema: SettingDescriptor[];
  values: Record<string, unknown>;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export const NotificationsSettings: React.FC<{
  multiColumn?: boolean;
}> = () => {
  const intl = useIntl();
  const [schema, setSchema] = useState<SettingDescriptor[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<SaveStatus>('idle');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiRequestGet<NotificationsPayload>(
          'v1/settings/notifications',
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
      setStatus('saving');
      try {
        const res = await apiRequestPut<NotificationsPayload>(
          'v1/settings/notifications',
          { [name]: value },
        );
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
        <SettingsSpaceHeader
          title={intl.formatMessage(messages.title)}
          tagline={intl.formatMessage(messages.intro)}
        />

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

        <AllSettingsFooter />
      </div>
    </Stage>
  );
};
