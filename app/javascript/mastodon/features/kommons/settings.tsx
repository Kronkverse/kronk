/* eslint-disable @typescript-eslint/no-unnecessary-condition --
 * `cancelled` mutates in the useEffect cleanup after the async fetch
 * reads it. TS control-flow doesn't track the mutation across the
 * closure so the checks look "always truthy/falsy", but the guards
 * are load-bearing: without them setState fires after unmount. */

import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';

import api, { apiRequestGet } from 'mastodon/api';
import type {
  ApiKornerSettingJSON,
  ApiKornerNotificationTypeJSON,
} from 'mastodon/api_types/korners';
import { AllSettingsFooter } from 'mastodon/components/all_settings_footer';
import { Stage } from 'mastodon/components/stage';
import { SettingsSection } from 'mastodon/features/settings/section';
import { SettingsSpaceHeader } from 'mastodon/features/settings/space_header';

import { KoinWallet } from './components/koin_wallet';
import type { Wallet } from './components/koin_wallet';

// /hub/kommons/settings — bespoke settings page for Kommons per
// Standard §L8 (revised) + §L12. Wallet + proposal filter + per-type
// notification toggles + sovereignty note. Reuses the framework's
// `/api/v1/korners/kommons/settings` endpoint for the manifest
// options and per-notification-type push preferences (same shape as
// KornerSettings uses), but composes it alongside the live wallet
// balance from /api/v1/token_balance so the user can see the token
// state they're tuning notifications about.
//
// Chrome: L12 — Stage + `.space-header`, SettingsBadge in the
// SpaceNav slot handles back-nav.

const messages = defineMessages({
  title: { id: 'kommons.settings.title', defaultMessage: 'Kommons' },
  intro: {
    id: 'kommons.settings.intro',
    defaultMessage:
      "Your ₭oin wallet, which proposals you see, and how Kommons speaks to you. Your vote and stake stay local — Kommons doesn't federate.",
  },
  loading: {
    id: 'kommons.settings.loading',
    defaultMessage: 'Loading…',
  },

  walletTitle: {
    id: 'kommons.settings.wallet_title',
    defaultMessage: 'Your ₭oin wallet',
  },
  walletLead: {
    id: 'kommons.settings.wallet_lead',
    defaultMessage:
      "Available ₭oin backs proposals; staked ₭oin returns when the seed resolves. You can't add ₭oin — it comes back to you as things ship.",
  },
  stakedDetail: {
    id: 'kommons.settings.staked_detail',
    defaultMessage:
      '{staked, plural, =0 {No ₭oin staked} one {# ₭oin staked on # proposal} other {# ₭oin staked on {seeds, plural, one {# proposal} other {# proposals}}}}',
  },

  filterTitle: {
    id: 'kommons.settings.filter_title',
    defaultMessage: 'Which proposals you see',
  },
  filterLead: {
    id: 'kommons.settings.filter_lead',
    defaultMessage:
      'Filter your Kommons Hub feed by proposal size. All three ship by default; untick to hide.',
  },
  sizeSmall: {
    id: 'kommons.settings.size_small',
    defaultMessage: 'Small',
  },
  sizeMedium: {
    id: 'kommons.settings.size_medium',
    defaultMessage: 'Medium',
  },
  sizeLarge: {
    id: 'kommons.settings.size_large',
    defaultMessage: 'Large',
  },

  notificationsTitle: {
    id: 'kommons.settings.notifications_title',
    defaultMessage: 'Notifications',
  },
  notificationsLead: {
    id: 'kommons.settings.notifications_lead',
    defaultMessage:
      'Which Kommons events fire a nudge, and whether we send you a push.',
  },
  notifyStateChange: {
    id: 'kommons.settings.notify_state_change',
    defaultMessage: 'Notify me when a proposal I backed changes state',
  },
  notifyStateChangeHint: {
    id: 'kommons.settings.notify_state_change_hint',
    defaultMessage:
      'Fires a nudge when a proposal you have staked ₭oin on advances, gets vetoed, or delivers.',
  },
  pushProposalChallenged: {
    id: 'kommons.settings.push.proposal_challenged',
    defaultMessage: 'Push — a proposal you authored gets a challenge',
  },
  pushProposalStatusChanged: {
    id: 'kommons.settings.push.proposal_status_changed',
    defaultMessage: 'Push — proposal state changes',
  },
  pushTaskAssigned: {
    id: 'kommons.settings.push.task_assigned',
    defaultMessage: 'Push — a task is assigned to you',
  },

  sovereigntyTitle: {
    id: 'kommons.settings.sovereignty_title',
    defaultMessage: 'Sovereignty',
  },
  sovereigntyBody: {
    id: 'kommons.settings.sovereignty_body',
    defaultMessage:
      'Kommons is local. Your ₭oin, your backing, your vote — none of it federates. What you stake is between you and the Kommunity, and the record is public here so the decisions can be seen together.',
  },

  saving: { id: 'kommons.settings.saving', defaultMessage: 'Saving…' },
  saved: { id: 'kommons.settings.saved', defaultMessage: 'Saved' },
  saveError: {
    id: 'kommons.settings.save_error',
    defaultMessage: 'Couldn’t save',
  },
});

interface ServerSettings {
  slug: string;
  tuned_in: boolean;
  push_enabled: boolean;
  push_preferences: Record<string, boolean>;
  values: Record<string, unknown>;
  settings_schema: ApiKornerSettingJSON[];
  notifications_schema: ApiKornerNotificationTypeJSON[];
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const SIZES = ['small', 'medium', 'large'] as const;
type Size = (typeof SIZES)[number];

const SIZE_LABELS: Record<Size, typeof messages.sizeSmall> = {
  small: messages.sizeSmall,
  medium: messages.sizeMedium,
  large: messages.sizeLarge,
};

const PUSH_LABELS: Record<string, typeof messages.pushProposalChallenged> = {
  proposal_challenged: messages.pushProposalChallenged,
  proposal_status_changed: messages.pushProposalStatusChanged,
  task_assigned: messages.pushTaskAssigned,
};

const KommonsSettings: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const [state, setState] = useState<ServerSettings | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Load manifest settings + wallet in parallel. Wallet is read-only
  // here (staking happens on the main Kommons surface); a failure
  // fetches leaves it null and the wallet card falls back to a
  // "unavailable" line rather than blocking the page.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [settingsRes, walletRes] = await Promise.all([
          apiRequestGet<ServerSettings>('v1/korners/kommons/settings'),
          api()
            .get<Wallet>('/api/v1/token_balance')
            .then((r) => r.data)
            .catch(() => null),
        ]);
        if (!cancelled) {
          setState(settingsRes);
          setWallet(walletRes);
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback((name: string, value: unknown) => {
    const timers = debounceRef.current;
    if (timers[name]) clearTimeout(timers[name]);

    timers[name] = setTimeout(() => {
      setStatus('saving');
      void (async () => {
        try {
          const res = await api().patch(
            `/api/v1/korners/kommons/settings/${encodeURIComponent(name)}`,
            { value },
          );
          setState(res.data as ServerSettings);
          setStatus('saved');
          setTimeout(() => {
            setStatus('idle');
          }, 1200);
        } catch (e: unknown) {
          setError(e instanceof Error ? e.message : String(e));
          setStatus('error');
          setTimeout(() => {
            setStatus('idle');
          }, 2000);
        }
      })();
    }, 400);
  }, []);

  const savePush = useCallback((notifType: string, enabled: boolean) => {
    const timers = debounceRef.current;
    const key = `push.${notifType}`;
    if (timers[key]) clearTimeout(timers[key]);

    timers[key] = setTimeout(() => {
      setStatus('saving');
      void (async () => {
        try {
          const res = await api().patch(
            `/api/v1/korners/kommons/settings/${encodeURIComponent(key)}`,
            { push_enabled: enabled },
          );
          setState(res.data as ServerSettings);
          setStatus('saved');
          setTimeout(() => {
            setStatus('idle');
          }, 1200);
        } catch (e: unknown) {
          setError(e instanceof Error ? e.message : String(e));
          setStatus('error');
          setTimeout(() => {
            setStatus('idle');
          }, 2000);
        }
      })();
    }, 400);
  }, []);

  const currentSizes = ((): Set<Size> => {
    const raw = state?.values.preferred_proposal_types;
    if (Array.isArray(raw)) {
      return new Set(raw.filter((s): s is Size => SIZES.includes(s as Size)));
    }
    return new Set(SIZES); // default: all three
  })();

  const handleSizeToggle = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >(
    (e) => {
      if (!state) return;
      const size = e.currentTarget.value as Size;
      const next = new Set(currentSizes);
      if (e.currentTarget.checked) next.add(size);
      else next.delete(size);
      const value = SIZES.filter((s) => next.has(s));
      setState({
        ...state,
        values: { ...state.values, preferred_proposal_types: value },
      });
      save('preferred_proposal_types', value);
    },
    [state, currentSizes, save],
  );

  const notifyOnStatusChange = state?.values.notify_on_status_change === true;

  const handleNotifyStateChangeToggle = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >(
    (e) => {
      if (!state) return;
      const next = e.currentTarget.checked;
      setState({
        ...state,
        values: { ...state.values, notify_on_status_change: next },
      });
      save('notify_on_status_change', next);
    },
    [state, save],
  );

  const handlePushToggle = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >(
    (e) => {
      if (!state) return;
      const notifType = e.currentTarget.dataset.notif;
      if (!notifType) return;
      const next = e.currentTarget.checked;
      setState({
        ...state,
        push_preferences: { ...state.push_preferences, [notifType]: next },
      });
      savePush(notifType, next);
    },
    [state, savePush],
  );

  if (!state) {
    return (
      <Stage label={intl.formatMessage(messages.title)}>
        <div className='scrollable kommons-settings'>
          <p className='kommons-settings__loading'>
            {error ?? intl.formatMessage(messages.loading)}
          </p>
        </div>
      </Stage>
    );
  }

  const notifTypes = state.notifications_schema.filter(
    (t) => PUSH_LABELS[t.name],
  );

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <div className='scrollable kommons-settings'>
        <SettingsSpaceHeader
          title={intl.formatMessage(messages.title)}
          tagline={intl.formatMessage(messages.intro)}
        />

        <div className='kommons-settings__status-row'>
          <span
            className={`kommons-settings__status kommons-settings__status--${status}`}
            role='status'
          >
            {status === 'saving' && intl.formatMessage(messages.saving)}
            {status === 'saved' && intl.formatMessage(messages.saved)}
            {status === 'error' && intl.formatMessage(messages.saveError)}
          </span>
        </div>

        <SettingsSection
          heading={<FormattedMessage {...messages.walletTitle} />}
          hint={<FormattedMessage {...messages.walletLead} />}
        >
          {wallet && <KoinWallet wallet={wallet} />}
          {wallet && (
            <p className='kommons-settings__staked-detail'>
              <FormattedMessage
                {...messages.stakedDetail}
                values={{
                  staked: wallet.staked,
                  seeds: wallet.staked_seeds,
                }}
              />
            </p>
          )}
        </SettingsSection>

        <SettingsSection
          heading={<FormattedMessage {...messages.filterTitle} />}
          hint={<FormattedMessage {...messages.filterLead} />}
        >
          <div className='kommons-settings__checklist'>
            {SIZES.map((size) => (
              <label key={size} className='kommons-settings__checkbox'>
                <input
                  type='checkbox'
                  value={size}
                  checked={currentSizes.has(size)}
                  onChange={handleSizeToggle}
                />
                <span>{intl.formatMessage(SIZE_LABELS[size])}</span>
              </label>
            ))}
          </div>
        </SettingsSection>

        <SettingsSection
          heading={<FormattedMessage {...messages.notificationsTitle} />}
          hint={<FormattedMessage {...messages.notificationsLead} />}
        >
          <div className='kommons-settings__checklist'>
            <label className='kommons-settings__checkbox'>
              <input
                type='checkbox'
                checked={notifyOnStatusChange}
                onChange={handleNotifyStateChangeToggle}
                aria-label={intl.formatMessage(messages.notifyStateChange)}
              />
              <span className='kommons-settings__checkbox-stack'>
                <span className='kommons-settings__checkbox-title'>
                  <FormattedMessage {...messages.notifyStateChange} />
                </span>
                <span className='kommons-settings__checkbox-hint'>
                  <FormattedMessage {...messages.notifyStateChangeHint} />
                </span>
              </span>
            </label>
            {notifTypes.map((t) => {
              const label = PUSH_LABELS[t.name];
              const enabled = state.push_preferences[t.name] !== false;
              const text = label ? intl.formatMessage(label) : t.name;
              return (
                <label key={t.name} className='kommons-settings__checkbox'>
                  <input
                    type='checkbox'
                    data-notif={t.name}
                    checked={enabled}
                    onChange={handlePushToggle}
                  />
                  <span>{text}</span>
                </label>
              );
            })}
          </div>
        </SettingsSection>

        {/* Kommons doesn't inherit the "Propose changes" cross-link
            (same rule as KornerSettings) — a Kommons proposal about
            Kommons still opens the composer, but firing it *from* the
            settings page would be a self-link. */}
        <SettingsSection
          heading={<FormattedMessage {...messages.sovereigntyTitle} />}
          hint={<FormattedMessage {...messages.sovereigntyBody} />}
        />

        <AllSettingsFooter />
      </div>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default KommonsSettings;
