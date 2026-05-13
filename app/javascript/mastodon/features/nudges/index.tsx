import { useEffect, useState, useCallback, useRef } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { AxiosError } from 'axios';

import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';

import PartnerExchangeActiveIcon from '@/material-icons/400-24px/partner_exchange-fill.svg?react';
import PartnerExchangeIcon from '@/material-icons/400-24px/partner_exchange.svg?react';
import { importFetchedAccounts } from 'mastodon/actions/importer';
import { clearUnreadNudges } from 'mastodon/actions/notification_groups';
import { apiNudgeAccount, apiGetNudgePartners } from 'mastodon/api/accounts';
import type { ApiNudgePartner } from 'mastodon/api/accounts';
import { Avatar } from 'mastodon/components/avatar';
import { Button } from 'mastodon/components/button';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { DisplayName } from 'mastodon/components/display_name';
import { Icon } from 'mastodon/components/icon';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';
import type { NotificationGroupNudge } from 'mastodon/models/notification_group';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

interface NudgeAlertData {
  id: string;
  accountId: string;
}

const messages = defineMessages({
  title: { id: 'nudges.title', defaultMessage: 'Nudges' },
});

// ── Live nudge alert banner ───────────────────────────────────────────────────

const NudgeAlert: React.FC<{
  alert: NudgeAlertData;
  onDismiss: (id: string) => void;
}> = ({ alert, onDismiss }) => {
  const account = useAppSelector((state) =>
    state.accounts.get(alert.accountId),
  );
  const [nudgedBack, setNudgedBack] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => onDismiss(alert.id), 8000);
    return () => window.clearTimeout(t);
  }, [alert.id, onDismiss]);

  const handleNudgeBack = useCallback(async () => {
    if (loading || nudgedBack) return;
    setLoading(true);
    try {
      await apiNudgeAccount(alert.accountId);
      setNudgedBack(true);
    } catch (e: unknown) {
      if (e instanceof AxiosError && e.response?.status === 422) {
        setNudgedBack(true); // ping-pong: disable button
      }
      // Other errors: re-enable button so user can retry
    } finally {
      setLoading(false);
    }
  }, [alert.accountId, loading, nudgedBack]);

  if (!account) return null;

  return (
    <div className='nudge-alert'>
      <Icon id='partner_exchange' icon={PartnerExchangeActiveIcon} className='nudge-alert__icon' />
      <span className='nudge-alert__text'>
        <FormattedMessage
          id='nudges.alert.nudged_by'
          defaultMessage='<a>@{acct}</a> nudged you!'
          values={{
            acct: account.acct,
            a: (chunks) => (
              <Link to={`/@${account.acct}`}>{chunks}</Link>
            ),
          }}
        />
      </span>
      <Button
        compact
        disabled={loading || nudgedBack}
        onClick={handleNudgeBack}
      >
        {nudgedBack ? (
          <FormattedMessage id='nudges.nudged_back' defaultMessage='Nudged! 🔔' />
        ) : (
          <FormattedMessage id='nudges.nudge_back' defaultMessage='Nudge back' />
        )}
      </Button>
      <button
        className='nudge-alert__dismiss'
        onClick={() => onDismiss(alert.id)}
        aria-label='Dismiss'
      >
        ×
      </button>
    </div>
  );
};

// ── Partner card ──────────────────────────────────────────────────────────────

const NudgePartnerItem: React.FC<{ partner: ApiNudgePartner }> = ({
  partner,
}) => {
  const account = useAppSelector((state) =>
    state.accounts.get(partner.account_id),
  );
  const [nudgedBack, setNudgedBack] = useState(false);
  const [loading, setLoading] = useState(false);
  const canNudge = partner.can_nudge_back && !nudgedBack;

  const handleNudgeBack = useCallback(async () => {
    if (loading || !canNudge) return;
    setLoading(true);
    try {
      await apiNudgeAccount(partner.account_id);
      setNudgedBack(true);
    } catch (e: unknown) {
      if (e instanceof AxiosError && e.response?.status === 422) {
        setNudgedBack(true); // ping-pong: disable button
      }
      // Other errors: re-enable button so user can retry
    } finally {
      setLoading(false);
    }
  }, [partner.account_id, loading, canNudge]);

  if (!account) return null;

  return (
    <div className='nudge-partner-item'>
      <Link to={`/@${account.acct}`} className='nudge-partner-item__avatar'>
        <Avatar account={account} size={46} />
      </Link>

      <div className='nudge-partner-item__body'>
        <div className='nudge-partner-item__name'>
          <Link to={`/@${account.acct}`}>
            <DisplayName account={account} />
          </Link>
        </div>

        <div className='nudge-partner-item__meta'>
          <span className='nudge-partner-item__streak'>
            <Icon
              id='partner_exchange'
              icon={canNudge ? PartnerExchangeActiveIcon : PartnerExchangeIcon}
            />
            <FormattedMessage
              id='nudges.streak_count'
              defaultMessage='{count, plural, one {# nudge} other {# nudges}}'
              values={{ count: partner.streak }}
            />
          </span>
          {partner.last_nudge_at && (
            <span className='nudge-partner-item__time'>
              <RelativeTimestamp timestamp={partner.last_nudge_at} />
            </span>
          )}
        </div>

        <div className='nudge-partner-item__counts'>
          <FormattedMessage
            id='nudges.sent_received'
            defaultMessage='{sent} sent · {received} received'
            values={{ sent: partner.sent_count, received: partner.received_count }}
          />
        </div>
      </div>

      <div className='nudge-partner-item__action'>
        {canNudge ? (
          <Button compact disabled={loading} onClick={handleNudgeBack}>
            <FormattedMessage id='nudges.nudge_back' defaultMessage='Nudge back' />
          </Button>
        ) : nudgedBack ? (
          <Button compact disabled>
            <FormattedMessage id='nudges.nudged_back' defaultMessage='Nudged! 🔔' />
          </Button>
        ) : (
          <span className='nudge-partner-item__waiting'>
            <FormattedMessage id='nudges.awaiting_reply' defaultMessage='awaiting reply' />
          </span>
        )}
      </div>
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

const NudgesPage: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const [partners, setPartners] = useState<ApiNudgePartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<NudgeAlertData[]>([]);

  // Track nudge groups from streaming — used to detect incoming nudges
  const nudgeGroups = useAppSelector((state) =>
    [
      ...state.notificationGroups.groups,
      ...state.notificationGroups.pendingGroups,
    ].filter((g): g is NotificationGroupNudge => g.type === 'nudge'),
  );

  // group_key → latest_page_notification_at; seeded on first render so only
  // nudges arriving AFTER the panel opens trigger alerts.
  const seenGroupsRef = useRef<Map<string, string> | null>(null);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGetNudgePartners();
      if (data.accounts?.length) dispatch(importFetchedAccounts(data.accounts));
      setPartners(data.partners ?? []);
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  // On mount: clear badge, load partners, snapshot current groups as baseline
  useEffect(() => {
    dispatch(clearUnreadNudges());
    void load();
  }, [load, dispatch]);

  // Watch nudge groups — show an alert for any group that arrives or updates
  // after the panel was first rendered.
  useEffect(() => {
    if (seenGroupsRef.current === null) {
      // First run — seed the baseline; no alerts yet
      seenGroupsRef.current = new Map(
        nudgeGroups.map((g) => [g.group_key, g.latest_page_notification_at]),
      );
      return;
    }

    const newAlerts: NudgeAlertData[] = [];

    nudgeGroups.forEach((group) => {
      const seen = seenGroupsRef.current!.get(group.group_key);
      if (seen !== group.latest_page_notification_at) {
        // New group or updated timestamp → someone nudged us
        const accountId = group.sampleAccountIds[0];
        if (accountId) {
          newAlerts.push({
            id: `${group.group_key}-${group.latest_page_notification_at}`,
            accountId,
          });
        }
        seenGroupsRef.current!.set(
          group.group_key,
          group.latest_page_notification_at,
        );
      }
    });

    if (newAlerts.length > 0) {
      setAlerts((prev) => [...newAlerts, ...prev].slice(0, 5));
      void load();
    }
  }, [nudgeGroups, load]);

  return (
    <Column
      bindToDocument={!multiColumn}
      label={intl.formatMessage(messages.title)}
    >
      <ColumnHeader
        icon='partner_exchange'
        iconComponent={PartnerExchangeActiveIcon}
        title={intl.formatMessage(messages.title)}
        multiColumn={multiColumn}
        showBackButton
      />

      {alerts.length > 0 && (
        <div className='nudge-alerts'>
          {alerts.map((alert) => (
            <NudgeAlert key={alert.id} alert={alert} onDismiss={dismissAlert} />
          ))}
        </div>
      )}

      <div className='scrollable'>
        {loading && (
          <div className='loading-indicator'>
            <div className='loading-indicator__figure' />
          </div>
        )}

        {!loading && partners.length === 0 && (
          <div className='empty-column-indicator'>
            <FormattedMessage
              id='nudges.empty'
              defaultMessage='No nudges yet. Go nudge someone cute!'
            />
          </div>
        )}

        {!loading && partners.length > 0 && (
          <div className='nudge-partners-list'>
            {partners.map((partner) => (
              <NudgePartnerItem key={partner.account_id} partner={partner} />
            ))}
          </div>
        )}
      </div>

      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>
    </Column>
  );
};

export default NudgesPage;
