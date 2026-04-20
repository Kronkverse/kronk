import { useEffect, useState, useCallback } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';

import HailActiveIcon from '@/material-icons/400-24px/hail-fill.svg?react';
import HailIcon from '@/material-icons/400-24px/hail.svg?react';
import { importFetchedAccounts } from 'mastodon/actions/importer';
import { apiGetNudgeHistory } from 'mastodon/api/accounts';
import type { ApiNudgeHistoryItem } from 'mastodon/api/accounts';
import { Avatar } from 'mastodon/components/avatar';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { DisplayName } from 'mastodon/components/display_name';
import { Icon } from 'mastodon/components/icon';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

const messages = defineMessages({
  title: { id: 'nudges.title', defaultMessage: 'Nudges' },
});

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
    </div>
  );
};

const NudgesPage: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const [history, setHistory] = useState<ApiNudgeHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

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
    void load();
  }, [load]);

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
              defaultMessage="No nudges yet. Go hail someone!"
            />
          </div>
        )}

        {!loading && history.length > 0 && (
          <div className='nudge-history'>
            {history.map((item, i) => (
              <NudgeHistoryItem key={`${item.direction}-${item.account_id}-${i}`} item={item} />
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
