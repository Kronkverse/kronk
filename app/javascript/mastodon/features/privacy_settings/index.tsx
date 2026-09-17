/* eslint-disable @typescript-eslint/no-unnecessary-condition --
 * `cancelled` mutates in the useEffect cleanup after the async fetch
 * reads it. TS control-flow doesn't track the mutation across the
 * closure so the checks look "always truthy/falsy", but the guards
 * are load-bearing: without them setState fires after unmount. */

import { useEffect, useMemo, useState, useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';
import type { MessageDescriptor } from 'react-intl';

import {
  apiRequestGet,
  apiRequestPut,
  apiRequestPost,
  apiRequestDelete,
} from 'mastodon/api';
import { ReachBoxes } from 'mastodon/components/reach_boxes';
import type { ReachValue } from 'mastodon/components/reach_dropdown';
import {
  SettingsPage,
  SettingsSection,
  SettingsRow,
} from 'mastodon/features/settings/components';
import type { SaveStatus } from 'mastodon/features/settings/components';
import { ListManager } from 'mastodon/features/settings/list_manager';
import { NamedSettingRow } from 'mastodon/features/settings/setting_widgets';
import type { SettingDescriptor } from 'mastodon/features/settings/setting_widgets';

// Privacy — the widest personal page. Groups into: Reach (the boxes
// row for profile visibility), Discoverability (search / directory
// listings), Interactions (follow approval, DM gate, follower list
// visibility), Client attribution (posting-app label), and Manage
// lists (mutes / blocks). Formerly a chimera of schema-driven flat
// fields + a bespoke ReachBoxes + two ListManagers hanging off the
// bottom — now every group speaks the shared section chrome.

interface ListAccount {
  id: string;
  acct: string;
  display_name: string;
  avatar: string;
}

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

  sectionReachTitle: {
    id: 'privacy_settings.section.reach',
    defaultMessage: 'Your reach',
  },
  sectionDiscoveryTitle: {
    id: 'privacy_settings.section.discovery',
    defaultMessage: 'Discoverability',
  },
  sectionInteractionsTitle: {
    id: 'privacy_settings.section.interactions',
    defaultMessage: 'Interactions',
  },
  sectionInteractionsDesc: {
    id: 'privacy_settings.section.interactions_desc',
    defaultMessage: 'Who can follow you, message you, or see who you follow.',
  },
  sectionManageTitle: {
    id: 'privacy_settings.section.manage',
    defaultMessage: 'Manage lists',
  },

  profileVisibility: {
    id: 'privacy_settings.profile_visibility',
    defaultMessage: 'Who can see your profile',
  },
  profileVisibilityHint: {
    id: 'privacy_settings.profile_visibility_hint',
    defaultMessage:
      'Who can see your profile’s content — your shelves and the things you tell about yourself. Your name and picture stay visible in the Kommunity either way. Defaults to everyone on Kronk.',
  },
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
  kommunityDiscoverability: {
    id: 'privacy_settings.kommunity_discoverability',
    defaultMessage: 'Who can find you in the Kommunity list',
  },
  kommunityDiscoverabilityHint: {
    id: 'privacy_settings.kommunity_discoverability_hint',
    defaultMessage:
      'Controls whether you appear in the Kommunity Discover list. Independent of federation-side search.',
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

  domainsTitle: {
    id: 'privacy_settings.domains',
    defaultMessage: 'Blocked domains',
  },
  domainsHint: {
    id: 'privacy_settings.domains_hint',
    defaultMessage:
      'Every post from a blocked domain is hidden from your timeline, and nobody from that domain can follow you.',
  },
  domainsEmpty: {
    id: 'privacy_settings.domains_empty',
    defaultMessage: 'You haven\u2019t blocked any domains.',
  },
  domainsAddPlaceholder: {
    id: 'privacy_settings.domains_add_placeholder',
    defaultMessage: 'example.com',
  },
  domainsAdd: {
    id: 'privacy_settings.domains_add',
    defaultMessage: 'Block',
  },
  domainsRemove: {
    id: 'privacy_settings.domains_remove',
    defaultMessage: 'Unblock',
  },
});

const LABELS: Record<string, MessageDescriptor> = {
  locked: messages.locked,
  discoverable: messages.discoverable,
  kommunity_discoverability: messages.kommunityDiscoverability,
  hide_collections: messages.hideCollections,
};

const HINTS: Record<string, MessageDescriptor> = {
  locked: messages.lockedHint,
  discoverable: messages.discoverableHint,
  kommunity_discoverability: messages.kommunityDiscoverabilityHint,
  hide_collections: messages.hideCollectionsHint,
};

// `profile_visibility` is rendered separately (ReachBoxes), and the
// list managers aren't schema fields — everything else is grouped by
// its natural cluster below.
const SECTIONS = [
  {
    key: 'discovery',
    titleMsg: messages.sectionDiscoveryTitle,
    descMsg: null,
    fields: ['discoverable', 'kommunity_discoverability'],
  },
  {
    key: 'interactions',
    titleMsg: messages.sectionInteractionsTitle,
    descMsg: messages.sectionInteractionsDesc,
    fields: ['locked', 'hide_collections'],
  },
] as const;

const REACH_VALUES: readonly ReachValue[] = [
  'public',
  'mates',
  'orbit',
  'self_only',
];

interface PrivacyPayload {
  settings_schema: SettingDescriptor[];
  values: Record<string, unknown>;
}

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

  const handleProfileVisibility = useCallback(
    (value: ReachValue) => {
      void save('profile_visibility', value);
    },
    [save],
  );

  const rawProfileVisibility = values.profile_visibility;
  const profileVisibility: ReachValue =
    typeof rawProfileVisibility === 'string' &&
    (REACH_VALUES as readonly string[]).includes(rawProfileVisibility)
      ? (rawProfileVisibility as ReachValue)
      : 'public';

  const hasReach = schema.some((s) => s.name === 'profile_visibility');

  const bySection = useMemo(() => {
    const map = new Map<string, SettingDescriptor[]>();
    for (const s of SECTIONS) map.set(s.key, []);
    map.set('other', []);
    for (const setting of schema) {
      if (setting.name === 'profile_visibility') continue;
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
      {loaded && hasReach && (
        <SettingsSection title={intl.formatMessage(messages.sectionReachTitle)}>
          <SettingsRow
            label={intl.formatMessage(messages.profileVisibility)}
            description={intl.formatMessage(messages.profileVisibilityHint)}
            stack
          >
            <ReachBoxes
              value={profileVisibility}
              onChange={handleProfileVisibility}
            />
          </SettingsRow>
        </SettingsSection>
      )}

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

      <SettingsSection title={intl.formatMessage(messages.sectionManageTitle)}>
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
        <DomainBlocksList />
      </SettingsSection>
    </SettingsPage>
  );
};

// Blocked domains. Own component rather than a ListManager reuse:
// `v1/domain_blocks` returns bare strings (not JSON rows) and needs
// an add form on top, neither of which `ListManager` covers. Same
// visual language via the shared `settings-list-manager__*` classes.
const DomainBlocksList: React.FC = () => {
  const intl = useIntl();
  const [domains, setDomains] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiRequestGet<string[]>('v1/domain_blocks');
        if (!cancelled) {
          setDomains(res);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setPending(e.currentTarget.value);
    },
    [],
  );

  const handleAdd = useCallback<React.FormEventHandler<HTMLFormElement>>(
    (e) => {
      e.preventDefault();
      // Normalise: strip protocol, trailing slash, lowercase. The
      // server will validate; this just avoids obvious pastes-with-junk.
      const raw = pending
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '');
      if (!raw || busy) return;

      setBusy(true);
      const previous = domains;
      // Optimistic \u2014 prepend and clear the input.
      if (!previous.includes(raw)) setDomains([raw, ...previous]);
      setPending('');

      void apiRequestPost(`v1/domain_blocks?domain=${encodeURIComponent(raw)}`)
        .catch(() => {
          setDomains(previous);
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [pending, busy, domains],
  );

  const handleRemove = useCallback(
    (domain: string) => {
      const previous = domains;
      setDomains(previous.filter((d) => d !== domain));
      void apiRequestDelete(
        `v1/domain_blocks?domain=${encodeURIComponent(domain)}`,
      ).catch(() => {
        setDomains(previous);
      });
    },
    [domains],
  );

  return (
    <div className='settings-list-manager'>
      <div className='settings-list-manager__header'>
        <span className='settings-list-manager__title'>
          {intl.formatMessage(messages.domainsTitle)}
        </span>
      </div>
      <p className='settings-list-manager__hint'>
        {intl.formatMessage(messages.domainsHint)}
      </p>

      <form className='settings-list-manager__add' onSubmit={handleAdd}>
        <input
          type='text'
          value={pending}
          onChange={handleChange}
          placeholder={intl.formatMessage(messages.domainsAddPlaceholder)}
          aria-label={intl.formatMessage(messages.domainsTitle)}
          spellCheck={false}
          autoCapitalize='off'
          autoCorrect='off'
        />
        <button type='submit' disabled={busy || pending.trim() === ''}>
          {intl.formatMessage(messages.domainsAdd)}
        </button>
      </form>

      {loaded &&
        (domains.length === 0 ? (
          <p className='settings-list-manager__empty'>
            {intl.formatMessage(messages.domainsEmpty)}
          </p>
        ) : (
          <ul className='settings-list-manager__list'>
            {domains.map((domain) => (
              <DomainRow
                key={domain}
                domain={domain}
                onRemove={handleRemove}
                removeLabel={intl.formatMessage(messages.domainsRemove)}
              />
            ))}
          </ul>
        ))}
    </div>
  );
};

const DomainRow: React.FC<{
  domain: string;
  onRemove: (domain: string) => void;
  removeLabel: string;
}> = ({ domain, onRemove, removeLabel }) => {
  const handleClick = useCallback(() => {
    onRemove(domain);
  }, [domain, onRemove]);
  return (
    <li className='settings-list-manager__item'>
      <span className='settings-list-manager__labels'>
        <span className='settings-list-manager__primary'>{domain}</span>
      </span>
      <button
        type='button'
        className='settings-list-manager__remove'
        onClick={handleClick}
      >
        {removeLabel}
      </button>
    </li>
  );
};
