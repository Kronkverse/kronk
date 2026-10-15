import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';

import {
  apiClearKlotData,
  apiDeleteKlotViewer,
  apiGetKlotSelf,
  apiGetKlotViewers,
} from 'mastodon/api/klot';
import type { ApiKlotSelfJSON, ApiKlotViewerJSON } from 'mastodon/api/klot';
import { AllSettingsFooter } from 'mastodon/components/all_settings_footer';
import { Stage } from 'mastodon/components/stage';
import { SettingsSection } from 'mastodon/features/settings/section';
import { SettingsSpaceHeader } from 'mastodon/features/settings/space_header';

// /hub/klot/settings — bespoke settings page for Klot per Standard §L8
// (revised) + §L12. What the log says about your cycle (it is worked
// out, not typed in), who you share your phase with, and a "clear
// everything" danger action that the mine view doesn't need to surface.
//
// Wired to the Klot-native endpoints (/api/v1/klot/self, viewers) so
// values land in CycleProfile / PhaseShare, NOT the framework-level
// UserKornerSetting. The manifest's `settings:` block still declares
// cycle_length_days / period_length_days / share_phase_publicly for
// framework consumers (settings hub, doctor); this page is the real
// user-facing surface.

const messages = defineMessages({
  title: { id: 'klot.settings.title', defaultMessage: 'Klot' },
  intro: {
    id: 'klot.settings.intro',
    defaultMessage:
      'Your cycle math + who you share your phase with. Everything else about your cycle stays on your account — nothing federates, nothing leaves.',
  },
  loading: { id: 'klot.loading', defaultMessage: 'Loading…' },
  cycleTitle: { id: 'klot.settings.cycle_title', defaultMessage: 'Your cycle' },
  cycleLead: {
    id: 'klot.settings.cycle_lead',
    defaultMessage:
      'Klot works these out from the periods you log, so there is nothing to type in. To change them, correct your log in My cycle.',
  },
  cycleKnown: {
    id: 'klot.settings.cycle_known',
    defaultMessage:
      '{days}-day cycle, from {count, plural, one {# cycle} other {# cycles}} logged.',
  },
  cycleUnknown: {
    id: 'klot.settings.cycle_unknown',
    defaultMessage:
      'Going by a typical {days} days until a second period is logged.',
  },
  periodKnown: {
    id: 'klot.settings.period_known',
    defaultMessage: '{days}-day period, from the ones you have ended.',
  },
  periodUnknown: {
    id: 'klot.settings.period_unknown',
    defaultMessage:
      'Going by a typical {days}-day period until you log when one ends.',
  },
  sharedTitle: {
    id: 'klot.settings.shared_title',
    defaultMessage: 'Sharing with',
  },
  sharedLead: {
    id: 'klot.settings.shared_lead',
    defaultMessage:
      'Only these people can see your phase. They see a moon and a phase name — never your log, dates, or notes. Revoke at any time.',
  },
  noViewers: {
    id: 'klot.settings.no_viewers',
    defaultMessage: "You haven't shared with anyone.",
  },
  removeViewer: {
    id: 'klot.shared.remove',
    defaultMessage: 'Stop sharing',
  },
  addViewerHint: {
    id: 'klot.settings.add_viewer_hint',
    defaultMessage:
      'To share with someone new, use Share with a Mate under Shared with, in My cycle.',
  },
  sovereigntyTitle: {
    id: 'klot.settings.sovereignty_title',
    defaultMessage: 'Sovereignty',
  },
  sovereigntyBody: {
    id: 'klot.settings.sovereignty_body',
    defaultMessage:
      'Your cycle data lives on your account. It never federates and Kronk never shares your log — recipients only see the phase you allow, nothing beneath it. If you leave, so does your cycle.',
  },
  dangerTitle: {
    id: 'klot.settings.danger_title',
    defaultMessage: 'Danger zone',
  },
  dangerLead: {
    id: 'klot.settings.danger_lead',
    defaultMessage:
      'Delete every period you have logged and everything written on any day: bleeding, symptoms and notes. Your share list stays. This cannot be undone.',
  },
  clearLogs: {
    id: 'klot.settings.clear_logs',
    defaultMessage: 'Clear everything I have logged',
  },
  clearLogsConfirm: {
    id: 'klot.settings.clear_logs_confirm',
    defaultMessage:
      'Delete every period, symptom and note you have logged in Klot?',
  },
  clearing: {
    id: 'klot.settings.clearing',
    defaultMessage: 'Clearing…',
  },
  proposeSection: {
    id: 'korner_settings.propose_section',
    defaultMessage: 'Propose changes',
  },
  proposeHint: {
    id: 'korner_settings.propose_hint',
    defaultMessage:
      'Want to change how this space works? Open a Kommons proposal — it lands on this space and anyone can back it.',
  },
  proposeCTA: {
    id: 'korner_settings.propose_cta',
    defaultMessage: 'Propose a change to {name}',
  },
});

const KlotSettings: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const [self, setSelf] = useState<ApiKlotSelfJSON | null>(null);
  const [viewers, setViewers] = useState<ApiKlotViewerJSON[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [selfRes, viewersRes] = await Promise.all([
        apiGetKlotSelf(),
        apiGetKlotViewers(),
      ]);
      setSelf(selfRes);
      setViewers(viewersRes);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRemoveViewer = useCallback<
    React.MouseEventHandler<HTMLButtonElement>
  >((e) => {
    const accountId = e.currentTarget.dataset.accountId;
    if (!accountId) return;
    void (async () => {
      try {
        await apiDeleteKlotViewer(accountId);
        setViewers((prev) => prev.filter((v) => v.account_id !== accountId));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, []);

  const handleClearLogs = useCallback(() => {
    // Native confirm — good enough for a destructive one-off; a modal
    // can replace it if this action grows other flows.
    if (!window.confirm(intl.formatMessage(messages.clearLogsConfirm))) return;

    setClearing(true);
    void (async () => {
      try {
        setSelf(await apiClearKlotData());
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setClearing(false);
      }
    })();
  }, [intl]);

  if (!self) {
    return (
      <Stage label={intl.formatMessage(messages.title)}>
        <div className='scrollable klot klot-settings'>
          <SettingsSpaceHeader
            title={intl.formatMessage(messages.title)}
            tagline={intl.formatMessage(messages.intro)}
          />
          <p className='klot__loading'>
            {error ?? intl.formatMessage(messages.loading)}
          </p>
        </div>
      </Stage>
    );
  }

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <div className='scrollable klot klot-settings'>
        <SettingsSpaceHeader
          title={intl.formatMessage(messages.title)}
          tagline={intl.formatMessage(messages.intro)}
        />

        <SettingsSection
          heading={<FormattedMessage {...messages.cycleTitle} />}
          hint={<FormattedMessage {...messages.cycleLead} />}
        >
          <p className='klot-card__lead'>
            <FormattedMessage
              {...(self.cycle_known
                ? messages.cycleKnown
                : messages.cycleUnknown)}
              values={{ days: self.cycle_length, count: self.cycles_logged }}
            />
          </p>
          <p className='klot-card__lead'>
            <FormattedMessage
              {...(self.period_known
                ? messages.periodKnown
                : messages.periodUnknown)}
              values={{ days: self.period_length }}
            />
          </p>
        </SettingsSection>

        <SettingsSection
          heading={<FormattedMessage {...messages.sharedTitle} />}
          hint={<FormattedMessage {...messages.sharedLead} />}
        >
          {viewers.length === 0 ? (
            <div className='klot-card__empty'>
              <FormattedMessage {...messages.noViewers} />
            </div>
          ) : (
            <ul className='klot-card__viewers'>
              {viewers.map((v) => (
                <li key={v.account_id} className='klot-card__viewer'>
                  <span
                    className='klot-card__viewer-avatar'
                    aria-hidden='true'
                    data-initial={v.name.charAt(0).toUpperCase()}
                  >
                    {v.name.charAt(0).toUpperCase()}
                  </span>
                  <span className='klot-card__viewer-identity'>
                    <span className='klot-card__viewer-name'>{v.name}</span>
                    <span className='klot-card__viewer-handle'>
                      @{v.handle}
                    </span>
                  </span>
                  <button
                    type='button'
                    data-account-id={v.account_id}
                    onClick={handleRemoveViewer}
                    aria-label={intl.formatMessage(messages.removeViewer)}
                    className='klot-card__viewer-remove'
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className='klot-card__hint'>
            <FormattedMessage {...messages.addViewerHint} />
          </p>
        </SettingsSection>

        <SettingsSection
          heading={<FormattedMessage {...messages.sovereigntyTitle} />}
          hint={<FormattedMessage {...messages.sovereigntyBody} />}
        />

        {/* Standard cross-space link (same shape as KornerSettings —
            eventually a shared component when the bespoke Kommons +
            Kuestions pages also inherit it). */}
        <SettingsSection
          heading={<FormattedMessage {...messages.proposeSection} />}
          hint={<FormattedMessage {...messages.proposeHint} />}
        >
          <Link
            to={{
              pathname: '/hub/kommons/composer',
              search: '?space=klot',
            }}
            className='korner-settings__propose-cta'
          >
            <FormattedMessage
              {...messages.proposeCTA}
              values={{ name: 'Klot' }}
            />
          </Link>
        </SettingsSection>

        <SettingsSection
          variant='danger'
          heading={<FormattedMessage {...messages.dangerTitle} />}
          hint={<FormattedMessage {...messages.dangerLead} />}
        >
          <button
            type='button'
            onClick={handleClearLogs}
            className='klot-card__log-btn klot-card__log-btn--danger'
            disabled={clearing}
          >
            {clearing ? (
              <FormattedMessage {...messages.clearing} />
            ) : (
              <FormattedMessage {...messages.clearLogs} />
            )}
          </button>
        </SettingsSection>

        {error && <p className='klot__error'>{error}</p>}

        <AllSettingsFooter />
      </div>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default KlotSettings;
