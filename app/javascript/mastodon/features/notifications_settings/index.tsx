/* eslint-disable @typescript-eslint/no-unnecessary-condition --
 * `cancelled` mutates in the useEffect cleanup after the async fetch
 * reads it. TS control-flow doesn't track the mutation across the
 * closure so the checks look "always truthy/falsy", but the guards
 * are load-bearing: without them setState fires after unmount. */

import { useEffect, useMemo, useState, useCallback } from 'react';

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
  NamedSettingRow,
} from 'mastodon/features/settings/setting_widgets';
import type { SettingDescriptor } from 'mastodon/features/settings/setting_widgets';

// Notifications. Two concerns share this page:
//   1. EMAIL delivery — the historical purpose (frequency / activity /
//      announcements). Backed by /api/v1/settings/notifications.
//   2. In-app NUDGES — which nudge event types reach the user at all
//      (in-app row + push). Grouped by korner + a "People" bucket for
//      Mastodon-native person-to-person types. Backed by
//      /api/v1/settings/nudges. Added Tal audit 2026-09-13.
// The Nudges section is a checkbox-per-type list; checked = receive.
// Server stores the inverted set (`muted_types`); we PUT the mute list
// on toggle. See Api::V1::Settings::NudgesController.

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
    defaultMessage: 'In-app nudges',
  },
  sectionNudgesDesc: {
    id: 'notifications_settings.section.nudges_desc',
    defaultMessage:
      'Which in-app pings you receive. Turning one off silences both the in-app row and any push.',
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

interface NudgeType {
  key: string;
  korner: string | null;
  korner_name: string | null;
  label: string;
  muted: boolean;
  interactive?: boolean;
}

interface NudgesPayload {
  types: NudgeType[];
  muted_types: string[];
}

export const NotificationsSettings: React.FC<{
  multiColumn?: boolean;
}> = () => {
  const intl = useIntl();
  const [schema, setSchema] = useState<SettingDescriptor[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [nudgeTypes, setNudgeTypes] = useState<NudgeType[]>([]);
  const [nudgesLoaded, setNudgesLoaded] = useState(false);

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
    void (async () => {
      try {
        const res = await apiRequestGet<NudgesPayload>('v1/settings/nudges');
        if (!cancelled) {
          setNudgeTypes(res.types);
          setNudgesLoaded(true);
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

  // Flip the mute state of one nudge type. UI is inverted from the wire
  // format: the checkbox is "receive nudge" (i.e., !muted). We optimise
  // locally, PUT the whole desired mute list, and re-sync from the
  // response (server drops unknown keys — trusting our own catalogue).
  const toggleNudge = useCallback(
    async (key: string, receive: boolean) => {
      const previous = nudgeTypes;
      const nextTypes = nudgeTypes.map((t) =>
        t.key === key ? { ...t, muted: !receive } : t,
      );
      setNudgeTypes(nextTypes);
      setStatus('saving');
      try {
        const nextMuted = nextTypes.filter((t) => t.muted).map((t) => t.key);
        const res = await apiRequestPut<NudgesPayload>('v1/settings/nudges', {
          muted_types: nextMuted,
        });
        setNudgeTypes(res.types);
        setStatus('saved');
      } catch {
        setNudgeTypes(previous);
        setStatus('error');
      }
    },
    [nudgeTypes],
  );

  const nudgeGroups = useMemo(() => {
    const map = new Map<string, NudgeType[]>();
    for (const t of nudgeTypes) {
      const bucket =
        t.korner_name ?? intl.formatMessage(messages.nudgesGroupPeople);
      const arr = map.get(bucket) ?? [];
      arr.push(t);
      map.set(bucket, arr);
    }
    return Array.from(map.entries());
  }, [nudgeTypes, intl]);

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

      {nudgesLoaded &&
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
              <NudgeToggleRow key={t.key} type={t} onToggle={toggleNudge} />
            ))}
          </SettingsSection>
        ))}
    </SettingsPage>
  );
};

// One row in the In-app nudges section. UI is "receive" (checkbox
// checked = not muted); we translate to/from the wire's muted_types
// list in the parent handler. Kept local: the row shape (label +
// toggle) is trivial and there's no other consumer.
const NudgeToggleRow: React.FC<{
  type: NudgeType;
  onToggle: (key: string, receive: boolean) => void | Promise<void>;
}> = ({ type, onToggle }) => {
  const handleChange = useCallback(
    (receive: boolean) => {
      void onToggle(type.key, receive);
    },
    [onToggle, type.key],
  );
  return (
    <SettingsRow label={type.label}>
      <BooleanWidget
        value={!type.muted}
        onChange={handleChange}
        ariaLabel={type.label}
      />
    </SettingsRow>
  );
};
