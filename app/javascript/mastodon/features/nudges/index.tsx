import { useEffect, useState, useCallback, useRef, useMemo } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';

import HailActiveIcon from '@/material-icons/400-24px/hail-fill.svg?react';
import HailIcon from '@/material-icons/400-24px/hail.svg?react';
import { importFetchedAccounts } from 'mastodon/actions/importer';
import { clearUnreadNudges } from 'mastodon/actions/notification_groups';
import { apiNudgeAccount, apiGetNudgeHistory } from 'mastodon/api/accounts';
import type { ApiNudgeHistoryItem } from 'mastodon/api/accounts';
import { Avatar } from 'mastodon/components/avatar';
import { Button } from 'mastodon/components/button';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { Icon } from 'mastodon/components/icon';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

const messages = defineMessages({
  title: { id: 'nudges.title', defaultMessage: 'Nudges' },
  pending: { id: 'nudges.pending', defaultMessage: 'Pending' },
  history: { id: 'nudges.history_section', defaultMessage: 'History' },
});

const NudgeBackButton: React.FC<{ accountId: string }> = ({ accountId }) => {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    if (loading || sent) return;
    setLoading(true);
    try {
      await apiNudgeAccount(accountId);
      setSent(true);
    } catch {
      // 422 means ping-pong rule blocked it (already nudged back)
      setSent(true);
    } finally {
      setLoading(false);
    }
  }, [accountId, loading, sent]);

  return (
    <Button compact disabled={loading || sent} onClick={handleClick}>
      {sent ? (
        <FormattedMessage id='nudges.nudged_back' defaultMessage='Nudged! 🔔' />
      ) : (
        <FormattedMessage id='nudges.nudge_back' defaultMessage='Nudge back' />
      )}
    </Button>
  );
};

const NudgeHistoryItem: React.FC<{ item: ApiNudgeHistoryItem }> = ({
  item,
}) => {
  const account = useAppSelector((state) =>
    state.accounts.get(item.account_id),
  );

  if (!account) return null;

  return (
    <div className={`nudge-history-item nudge-history-item--${item.direction}`}>
      <Link to={`/@${account.acct}`} className='nudge-history-item__avatar'>
        <Avatar account={account} size={36} />
      </Link>
      <div className='nudge-history-item__content'>
        <span className='nudge-history-item__label'>
          <Icon id='hail' icon={item.direction === 'sent' ? HailIcon : HailActiveIcon} />
          {item.direction === 'sent' ? (
            <FormattedMessage
              id='nudges.history.sent'
              defaultMessage='You nudged <a>@{acct}</a>'
              values={{
                acct: account.acct,
                a: (chunks) => <Link to={`/@${account.acct}`}>{chunks}</Link>,
              }}
            />
          ) : (
            <FormattedMessage
              id='nudges.history.received'
              defaultMessage='<a>@{acct}</a> nudged you'
              values={{
                acct: account.acct,
                a: (chunks) => <Link to={`/@${account.acct}`}>{chunks}</Link>,
              }}
            />
          )}
        </span>
        <span className='nudge-history-item__time'>
          <RelativeTimestamp timestamp={item.created_at} />
        </span>
      </div>
      {item.direction === 'received' && (
        <div className='nudge-history-item__action'>
          <NudgeBackButton accountId={item.account_id} />
        </div>
      )}
    </div>
  );
};

const NudgePendingItem: React.FC<{ item: ApiNudgeHistoryItem }> = ({
  item,
}) => {
  const account = useAppSelector((state) =>
    state.accounts.get(item.account_id),
  );

  if (!account) return null;

  return (
    <div className='nudge-pending-item'>
      <Link to={`/@${account.acct}`} className='nudge-pending-item__avatar'>
        <Avatar account={account} size={36} />
      </Link>
      <div className='nudge-pending-item__content'>
        <span className='nudge-pending-item__label'>
          <Icon id='hail' icon={HailIcon} />
          <FormattedMessage
            id='nudges.waiting_for'
            defaultMessage='Waiting for <a>{name}</a> to nudge back'
            values={{
              name: account.display_name || account.acct,
              a: (chunks) => (
                <Link to={`/@${account.acct}`}>{chunks}</Link>
              ),
            }}
          />
        </span>
        <span className='nudge-pending-item__time'>
          <RelativeTimestamp timestamp={item.created_at} />
        </span>
      </div>
    </div>
  );
};

const NudgesPage: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const [history, setHistory] = useState<ApiNudgeHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Pending = most recent nudge with a given partner was sent by us (waiting for reply)
  const pendingPartners = useMemo(() => {
    const seen = new Set<string>();
    const pending: ApiNudgeHistoryItem[] = [];
    for (const item of history) {
      if (!seen.has(item.account_id)) {
        seen.add(item.account_id);
        if (item.direction === 'sent') pending.push(item);
      }
    }
    return pending;
  }, [history]);

  // Watch for nudge notifications arriving via streaming so we auto-refresh
  const streamingNudgeCount = useAppSelector((state) =>
    [
      ...state.notificationGroups.groups,
      ...state.notificationGroups.pendingGroups,
    ].filter((g) => g.type === 'nudge').length,
  );
  const prevNudgeCountRef = useRef(streamingNudgeCount);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGetNudgeHistory();
      if (data.accounts?.length) dispatch(importFetchedAccounts(data.accounts));
      setHistory(data.nudges ?? []);
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    dispatch(clearUnreadNudges());
    void load();
  }, [load, dispatch]);

  // Re-fetch whenever a new nudge notification arrives via the streaming connection
  useEffect(() => {
    if (streamingNudgeCount > prevNudgeCountRef.current) {
      prevNudgeCountRef.current = streamingNudgeCount;
      void load();
    }
  }, [streamingNudgeCount, load]);

  return (
    <Column
      bindToDocument={!multiColumn}
      label={intl.formatMessage(messages.title)}
    >
      <ColumnHeader
        icon='hail'
        iconComponent={HailActiveIcon}
        title={intl.formatMessage(messages.title)}
        multiColumn={multiColumn}
        showBackButton
      />

      <div className='scrollable'>
        {loading && (
          <div className='loading-indicator'>
            <div className='loading-indicator__figure' />
          </div>
        )}

        {!loading && history.length === 0 && (
          <div className='empty-column-indicator'>
            <FormattedMessage
              id='nudges.empty'
              defaultMessage='No nudges yet. Go nudge someone cute!'
            />
          </div>
        )}

        {!loading && history.length > 0 && (
          <>
            {pendingPartners.length > 0 && (
              <div className='nudge-section'>
                <div className='nudge-section__header'>
                  {intl.formatMessage(messages.pending)}
                </div>
                <div className='nudge-pending-list'>
                  {pendingPartners.map((item) => (
                    <NudgePendingItem
                      key={item.account_id}
                      item={item}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className='nudge-section'>
              <div className='nudge-section__header'>
                {intl.formatMessage(messages.history)}
              </div>
              <div className='nudge-history'>
                {history.map((item, i) => (
                  <NudgeHistoryItem
                    key={`${item.direction}-${item.account_id}-${i}`}
                    item={item}
                  />
                ))}
              </div>
            </div>
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
