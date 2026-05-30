import { useEffect, useState, useCallback, useRef } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';

import { AxiosError } from 'axios';

import PartnerExchangeActiveIcon from '@/material-icons/400-24px/partner_exchange-fill.svg?react';
import { importFetchedAccounts } from 'mastodon/actions/importer';
import { openModal } from 'mastodon/actions/modal';
import {
  decrementNudgeCount,
  setUnreadNudgeCount,
} from 'mastodon/actions/notification_groups';
import { apiNudgeAccount, apiGetNudgePartners } from 'mastodon/api/accounts';
import type {
  ApiNudgePartner,
  ApiNudgeSuggestion,
} from 'mastodon/api/accounts';
import { Avatar } from 'mastodon/components/avatar';
import { Button } from 'mastodon/components/button';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { DisplayName } from 'mastodon/components/display_name';
import { Icon } from 'mastodon/components/icon';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';
import type { NotificationGroupNudge } from 'mastodon/models/notification_group';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

const MILESTONE_THRESHOLD = 10;

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
  const dispatch = useAppDispatch();
  const account = useAppSelector((state) =>
    state.accounts.get(alert.accountId),
  );
  const [nudgedBack, setNudgedBack] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      onDismiss(alert.id);
    }, 8000);
    return () => {
      window.clearTimeout(t);
    };
  }, [alert.id, onDismiss]);

  const handleDismiss = useCallback(() => {
    onDismiss(alert.id);
  }, [onDismiss, alert.id]);

  const handleNudgeBack = useCallback(() => {
    if (nudgedBack) return;
    dispatch(
      openModal({
        modalType: 'NUDGE_COMPOSE',
        modalProps: {
          accountId: alert.accountId,
          onSent: () => {
            setNudgedBack(true);
            dispatch(decrementNudgeCount());
          },
        },
      }),
    );
  }, [alert.accountId, nudgedBack, dispatch]);

  if (!account) return null;

  return (
    <div className='nudge-alert'>
      <Icon
        id='partner_exchange'
        icon={PartnerExchangeActiveIcon}
        className='nudge-alert__icon'
      />
      <span className='nudge-alert__text'>
        <FormattedMessage
          id='nudges.alert.nudged_by'
          defaultMessage='<a>@{acct}</a> has nudged you'
          values={{
            acct: account.acct,
            a: (chunks) => <Link to={`/@${account.acct}`}>{chunks}</Link>,
          }}
        />
      </span>
      <Button compact disabled={nudgedBack} onClick={handleNudgeBack}>
        {nudgedBack ? (
          <FormattedMessage id='nudges.nudged_back' defaultMessage='Nudged!' />
        ) : (
          <FormattedMessage
            id='nudges.nudge_back'
            defaultMessage='Nudge back'
          />
        )}
      </Button>
      <button
        className='nudge-alert__dismiss'
        onClick={handleDismiss}
        aria-label='Dismiss'
      >
        ×
      </button>
    </div>
  );
};

// ── Partner card ──────────────────────────────────────────────────────────────

const NudgePartnerItem: React.FC<{
  partner: ApiNudgePartner;
  onNudged: (accountId: string) => void;
}> = ({ partner, onNudged }) => {
  const dispatch = useAppDispatch();
  const account = useAppSelector((state) =>
    state.accounts.get(partner.account_id),
  );
  const [nudgedBack, setNudgedBack] = useState(false);
  const canNudge = partner.can_nudge_back && !nudgedBack;
  const isMilestone =
    partner.sent_count + partner.received_count >= MILESTONE_THRESHOLD;

  const handleNudgeBack = useCallback(() => {
    if (!canNudge) return;
    dispatch(
      openModal({
        modalType: 'NUDGE_COMPOSE',
        modalProps: {
          accountId: partner.account_id,
          onSent: () => {
            setNudgedBack(true);
            dispatch(decrementNudgeCount());
            onNudged(partner.account_id);
          },
        },
      }),
    );
  }, [partner.account_id, canNudge, dispatch, onNudged]);

  if (!account) return null;

  return (
    <div
      className={`nudge-partner-item${canNudge ? ' nudge-partner-item--active' : ''}`}
    >
      <Link to={`/@${account.acct}`} className='nudge-partner-item__avatar'>
        <Avatar account={account} size={46} />
      </Link>

      <div className='nudge-partner-item__body'>
        <div className='nudge-partner-item__name'>
          <Link to={`/@${account.acct}`}>
            <DisplayName account={account} />
          </Link>
          {isMilestone && (
            <span
              className='nudge-partner-item__milestone-star'
              aria-label='milestone'
            >
              ★
            </span>
          )}
        </div>

        <div className='nudge-partner-item__meta'>
          <span className='nudge-partner-item__streak-sent'>
            ↑ {partner.sent_count}
          </span>
          <span className='nudge-partner-item__streak-received'>
            ↓ {partner.received_count}
          </span>
          {partner.last_nudge_at && (
            <span className='nudge-partner-item__time'>
              <RelativeTimestamp timestamp={partner.last_nudge_at} />
            </span>
          )}
        </div>
      </div>

      <div className='nudge-partner-item__action'>
        {canNudge ? (
          <Button compact onClick={handleNudgeBack}>
            <FormattedMessage
              id='nudges.nudge_back'
              defaultMessage='Nudge back'
            />
          </Button>
        ) : nudgedBack ? (
          <Button compact disabled>
            <FormattedMessage
              id='nudges.nudged_back'
              defaultMessage='Nudged!'
            />
          </Button>
        ) : (
          <span className='nudge-partner-item__waiting'>
            <FormattedMessage
              id='nudges.awaiting_reply'
              defaultMessage='awaiting reply'
            />
          </span>
        )}
      </div>
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

// ── Suggestion card ───────────────────────────────────────────────────────────

const NudgeSuggestionItem: React.FC<{ suggestion: ApiNudgeSuggestion }> = ({
  suggestion,
}) => {
  const dispatch = useAppDispatch();
  const account = useAppSelector((state) =>
    state.accounts.get(suggestion.account_id),
  );
  const [nudged, setNudged] = useState(false);

  const handleNudge = useCallback(() => {
    if (nudged) return;
    dispatch(
      openModal({
        modalType: 'NUDGE_COMPOSE',
        modalProps: {
          accountId: suggestion.account_id,
          onSent: () => {
            setNudged(true);
          },
        },
      }),
    );
  }, [suggestion.account_id, nudged, dispatch]);

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
          <span style={{ opacity: 0.5 }}>@{account.acct}</span>
        </div>
      </div>
      <div className='nudge-partner-item__action'>
        {nudged ? (
          <Button compact disabled>
            <FormattedMessage
              id='nudges.nudged_back'
              defaultMessage='Nudged!'
            />
          </Button>
        ) : (
          <Button compact onClick={handleNudge}>
            <FormattedMessage
              id='account_nudges.nudge'
              defaultMessage='Nudge @{acct}'
              values={{ acct: account.acct }}
            />
          </Button>
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
  const [suggestions, setSuggestions] = useState<ApiNudgeSuggestion[]>([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [totalSent, setTotalSent] = useState(0);
  const [totalReceived, setTotalReceived] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showMore, setShowMore] = useState(false);
  const [alerts, setAlerts] = useState<NudgeAlertData[]>([]);

  const handleToggleShowMore = useCallback(() => {
    setShowMore((v) => !v);
  }, []);

  const nudgeGroups = useAppSelector((state) =>
    [
      ...state.notificationGroups.groups,
      ...state.notificationGroups.pendingGroups,
    ].filter((g): g is NotificationGroupNudge => g.type === 'nudge'),
  );

  const seenGroupsRef = useRef<Map<string, string> | null>(null);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handlePartnerNudged = useCallback((accountId: string) => {
    setPartners((prev) =>
      prev.map((p) =>
        p.account_id === accountId ? { ...p, can_nudge_back: false } : p,
      ),
    );
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGetNudgePartners();
      if (data.accounts.length) dispatch(importFetchedAccounts(data.accounts));
      setPartners(data.partners);
      setSuggestions(data.suggestions);
      setGrandTotal(data.grand_total);
      setTotalSent(data.total_sent);
      setTotalReceived(data.total_received);
      dispatch(setUnreadNudgeCount(data.pending_count));
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (seenGroupsRef.current === null) {
      seenGroupsRef.current = new Map(
        nudgeGroups.map((g) => [g.group_key, g.latest_page_notification_at]),
      );
      return;
    }

    const seenGroups = seenGroupsRef.current;
    const newAlerts: NudgeAlertData[] = [];
    nudgeGroups.forEach((group) => {
      const seen = seenGroups.get(group.group_key);
      if (seen !== group.latest_page_notification_at) {
        const accountId = group.sampleAccountIds[0];
        if (accountId) {
          newAlerts.push({
            id: `${group.group_key}-${group.latest_page_notification_at}`,
            accountId,
          });
        }
        seenGroups.set(group.group_key, group.latest_page_notification_at);
      }
    });

    if (newAlerts.length > 0) {
      setAlerts((prev) => [...newAlerts, ...prev].slice(0, 5));
      void load();
    }
  }, [nudgeGroups, load]);

  // Sort by streak desc, then split into top-3 / pending / hidden
  const sorted = [...partners].sort(
    (a, b) =>
      b.sent_count + b.received_count - (a.sent_count + a.received_count),
  );
  const topThreeIds = new Set(sorted.slice(0, 3).map((p) => p.account_id));
  const received = sorted.filter(
    (p) => p.can_nudge_back && !topThreeIds.has(p.account_id),
  );
  const topStreaks = sorted.filter((p) => topThreeIds.has(p.account_id));
  const hiddenPartners = sorted.filter(
    (p) => !topThreeIds.has(p.account_id) && !p.can_nudge_back,
  );

  // "nudge all back" applies to pending (received) + top-streak items that are pending
  const allPending = sorted.filter((p) => p.can_nudge_back);

  const handleNudgeAllBack = useCallback(() => {
    void (async () => {
      await Promise.allSettled(
        allPending.map(async (p) => {
          try {
            await apiNudgeAccount(p.account_id);
            dispatch(decrementNudgeCount());
          } catch (e: unknown) {
            if (!(e instanceof AxiosError && e.response?.status === 422))
              throw e;
          }
        }),
      );
      setPartners((prev) => prev.map((p) => ({ ...p, can_nudge_back: false })));
    })();
  }, [allPending, dispatch]);

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
        {!loading && (
          <div className='nudge-grand-total'>
            <span className='nudge-grand-total__label'>
              <FormattedMessage
                id='nudges.grand_total_label'
                defaultMessage='Grand Total of Nudges'
              />
            </span>
            <span className='nudge-grand-total__count'>{grandTotal}</span>
            <div className='nudge-grand-total__divider' />
            <div className='nudge-grand-total__stats'>
              <div className='nudge-grand-total__stat'>
                <span className='nudge-grand-total__stat-number nudge-grand-total__stat-number--sent'>
                  {totalSent}
                </span>
                <span className='nudge-grand-total__stat-label'>
                  <FormattedMessage
                    id='nudges.total_sent'
                    defaultMessage='SENT'
                  />
                </span>
              </div>
              <div className='nudge-grand-total__stat-divider' />
              <div className='nudge-grand-total__stat'>
                <span className='nudge-grand-total__stat-number nudge-grand-total__stat-number--received'>
                  {totalReceived}
                </span>
                <span className='nudge-grand-total__stat-label'>
                  <FormattedMessage
                    id='nudges.total_received'
                    defaultMessage='RECEIVED'
                  />
                </span>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className='loading-indicator'>
            <div className='loading-indicator__figure' />
          </div>
        )}

        {!loading && partners.length === 0 && suggestions.length === 0 && (
          <div className='empty-column-indicator'>
            <FormattedMessage
              id='nudges.empty'
              defaultMessage='No nudges yet. Go nudge someone cute!'
            />
          </div>
        )}

        {!loading && received.length > 0 && (
          <>
            <div className='nudge-section-header nudge-section-header--received'>
              <FormattedMessage
                id='nudges.section_received'
                defaultMessage='NUDGES RECEIVED'
              />
            </div>
            {allPending.length >= 2 && (
              <div className='nudge-all-back'>
                <Button onClick={handleNudgeAllBack}>
                  <FormattedMessage
                    id='nudges.nudge_all_back'
                    defaultMessage='Nudge back all {count}'
                    values={{ count: allPending.length }}
                  />
                </Button>
              </div>
            )}
            {received.map((partner) => (
              <NudgePartnerItem
                key={partner.account_id}
                partner={partner}
                onNudged={handlePartnerNudged}
              />
            ))}
          </>
        )}

        {!loading && topStreaks.length > 0 && (
          <>
            <div className='nudge-section-header nudge-section-header--sent'>
              <FormattedMessage
                id='nudges.section_top_streaks'
                defaultMessage='TOP STREAKS'
              />
            </div>
            {topStreaks.map((partner) => (
              <NudgePartnerItem
                key={partner.account_id}
                partner={partner}
                onNudged={handlePartnerNudged}
              />
            ))}
          </>
        )}

        {!loading && hiddenPartners.length > 0 && (
          <>
            {showMore &&
              hiddenPartners.map((partner) => (
                <NudgePartnerItem
                  key={partner.account_id}
                  partner={partner}
                  onNudged={handlePartnerNudged}
                />
              ))}
            <div className='nudge-show-more'>
              <button
                className='nudge-show-more__btn'
                onClick={handleToggleShowMore}
              >
                {showMore ? (
                  <FormattedMessage
                    id='nudges.show_less'
                    defaultMessage='Show less'
                  />
                ) : (
                  <FormattedMessage
                    id='nudges.show_more'
                    defaultMessage='Show {count} more'
                    values={{ count: hiddenPartners.length }}
                  />
                )}
              </button>
            </div>
          </>
        )}

        {!loading && suggestions.length > 0 && (
          <>
            <div className='nudge-section-header nudge-section-header--suggestions'>
              <FormattedMessage
                id='nudges.section_suggestions'
                defaultMessage='NUDGE SOMEONE'
              />
            </div>
            {suggestions.map((s) => (
              <NudgeSuggestionItem key={s.account_id} suggestion={s} />
            ))}
          </>
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
