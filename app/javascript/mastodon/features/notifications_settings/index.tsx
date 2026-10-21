/* eslint-disable @typescript-eslint/no-unnecessary-condition --
 * `cancelled` mutates in the useEffect cleanup after the async fetch
 * reads it. TS control-flow doesn't track the mutation across the
 * closure so the checks look "always truthy/falsy", but the guards
 * are load-bearing: without them setState fires after unmount. */

import { useEffect, useMemo, useState, useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';
import type { MessageDescriptor } from 'react-intl';

import { apiRequestGet, apiRequestPut } from 'mastodon/api';
import { PushPrompt } from 'mastodon/components/push_prompt';
import {
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from 'mastodon/features/settings/components';
import type { SaveStatus } from 'mastodon/features/settings/components';
import {
  NudgeSwitches,
  QuietHoursControl,
} from 'mastodon/features/settings/nudge_switches';
import { NamedSettingRow } from 'mastodon/features/settings/setting_widgets';
import type { SettingDescriptor } from 'mastodon/features/settings/setting_widgets';
import { useNudgeSettings } from 'mastodon/hooks/useNudgeSettings';
import type { NudgeSettingRow } from 'mastodon/hooks/useNudgeSettings';
import { useSaveQueue } from 'mastodon/hooks/useSaveQueue';

// Notifications. Three concerns share this page:
//   1. THIS DEVICE — turning push on here, and quiet hours.
//   2. NUDGES — per type, whether it shows in Nudges and whether it is
//      pushed (Tal 2026-10-19), plus push for chat messages. Grouped by
//      korner + a "People" bucket. Backed by /api/v1/settings/nudges
//      through useNudgeSettings, shared with korner settings pages.
//   3. EMAIL delivery (frequency / activity / announcements). Backed by
//      /api/v1/settings/notifications.

const messages = defineMessages({
  title: {
    id: 'notifications_settings.title',
    defaultMessage: 'Notifications',
  },
  intro: {
    id: 'notifications_settings.intro',
    defaultMessage: 'What reaches you: in Nudges, on your phone, and by email.',
  },
  sectionDeviceTitle: {
    id: 'notifications_settings.section.device',
    defaultMessage: 'This device',
  },
  deviceLabel: {
    id: 'notifications_settings.device_label',
    defaultMessage: 'Notifications here',
  },
  quietLabel: {
    id: 'notifications_settings.quiet_label',
    defaultMessage: 'Quiet hours',
  },
  quietHint: {
    id: 'notifications_settings.quiet_hint',
    defaultMessage:
      'Nothing is pushed in these hours, on any device. Nudges still arrive.',
  },
  sectionMessagesTitle: {
    id: 'notifications_settings.section.messages',
    defaultMessage: 'Messages',
  },

  sectionFrequencyTitle: {
    id: 'notifications_settings.section.frequency',
    defaultMessage: 'Frequency',
  },
  sectionActivityTitle: {
    id: 'notifications_settings.section.activity',
    defaultMessage: 'Activity',
  },
  sectionActivityDesc: {
    id: 'notifications_settings.section.activity_desc',
    defaultMessage: 'Which events send you an email.',
  },
  sectionAnnouncementsTitle: {
    id: 'notifications_settings.section.announcements',
    defaultMessage: 'Announcements',
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

  sectionNudgesTitle: {
    id: 'notifications_settings.section.nudges',
    defaultMessage: 'Nudges',
  },
  sectionNudgesDesc: {
    id: 'notifications_settings.section.nudges_desc',
    defaultMessage:
      'In Nudges: it shows up in your Nudges. Push: it is sent to each device you turned notifications on for.',
  },
  nudgesGroupPeople: {
    id: 'notifications_settings.nudges_group.people',
    defaultMessage: 'People',
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

const SECTIONS = [
  {
    key: 'frequency',
    titleMsg: messages.sectionFrequencyTitle,
    descMsg: null,
    fields: ['always_send_emails'],
  },
  {
    key: 'activity',
    titleMsg: messages.sectionActivityTitle,
    descMsg: messages.sectionActivityDesc,
    fields: [
      'email_mention',
      'email_follow',
      'email_follow_request',
      'email_reblog',
      'email_favourite',
      'email_quote',
      'email_event_invitation',
    ],
  },
  {
    key: 'announcements',
    titleMsg: messages.sectionAnnouncementsTitle,
    descMsg: null,
    fields: ['email_software_updates'],
  },
] as const;

interface NotificationsPayload {
  settings_schema: SettingDescriptor[];
  values: Record<string, unknown>;
}

export const NotificationsSettings: React.FC<{
  multiColumn?: boolean;
}> = () => {
  const intl = useIntl();
  const [schema, setSchema] = useState<SettingDescriptor[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const nudges = useNudgeSettings();

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

  const queueSave = useSaveQueue();
  const save = useCallback(
    async (name: string, value: unknown) => {
      const previous = values[name];
      setValues((v) => ({ ...v, [name]: value }));
      setStatus('saving');
      const { done, isLatest } = queueSave(() =>
        apiRequestPut<NotificationsPayload>('v1/settings/notifications', {
          [name]: value,
        }),
      );
      try {
        const res = await done;
        if (!isLatest()) return;
        setValues(res.values);
        setStatus('saved');
      } catch {
        // Undo this change, unless a newer one has replaced it.
        setValues((v) => (v[name] === value ? { ...v, [name]: previous } : v));
        if (!isLatest()) return;
        setStatus('error');
      }
    },
    [values, queueSave],
  );

  const handleSet = useCallback(
    (name: string, value: unknown) => {
      void save(name, value);
    },
    [save],
  );

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

  const nudgeGroups = useMemo(() => {
    const map = new Map<string, NudgeSettingRow[]>();
    for (const t of nudges.types) {
      const bucket =
        t.korner_name ?? intl.formatMessage(messages.nudgesGroupPeople);
      const arr = map.get(bucket) ?? [];
      arr.push(t);
      map.set(bucket, arr);
    }
    return Array.from(map.entries());
  }, [nudges.types, intl]);

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
      status={nudges.status === 'idle' ? status : nudges.status}
    >
      <SettingsSection title={intl.formatMessage(messages.sectionDeviceTitle)}>
        <SettingsRow label={intl.formatMessage(messages.deviceLabel)}>
          <PushPrompt variant='settings' />
        </SettingsRow>
        {nudges.quietHours && (
          <SettingsRow
            label={intl.formatMessage(messages.quietLabel)}
            description={intl.formatMessage(messages.quietHint)}
          >
            <QuietHoursControl
              value={nudges.quietHours}
              onChange={nudges.setQuietHours}
            />
          </SettingsRow>
        )}
      </SettingsSection>

      {nudges.loaded && (
        <SettingsSection
          title={intl.formatMessage(messages.sectionMessagesTitle)}
        >
          {nudges.messageTypes.map((t) => (
            <SettingsRow key={t.key} label={t.label}>
              <NudgeSwitches
                row={t}
                onShown={nudges.setShown}
                onPushed={nudges.setPushed}
              />
            </SettingsRow>
          ))}
        </SettingsSection>
      )}

      {nudges.loaded &&
        nudgeGroups.map(([groupName, types], index) => (
          <SettingsSection
            key={groupName}
            title={`${intl.formatMessage(messages.sectionNudgesTitle)} — ${groupName}`}
            // Only the first Nudges section carries the shared blurb —
            // repeating it under every group would read as noise.
            description={
              index === 0
                ? intl.formatMessage(messages.sectionNudgesDesc)
                : undefined
            }
          >
            {types.map((t) => (
              <SettingsRow key={t.key} label={t.label}>
                <NudgeSwitches
                  row={t}
                  onShown={nudges.setShown}
                  onPushed={nudges.setPushed}
                />
              </SettingsRow>
            ))}
          </SettingsSection>
        ))}

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
