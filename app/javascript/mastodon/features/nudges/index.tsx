import { useEffect, useState, useCallback, useRef } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';

import HailActiveIcon from '@/material-icons/400-24px/hail-fill.svg?react';
import HailIcon from '@/material-icons/400-24px/hail.svg?react';
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
import { useAppDispatch, useAppSelector } from 'mastodon/store';

const messages = defineMessages({
  title: { id: 'nudges.title', defaultMessage: 'Nudges' },
});

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
    } catch {
      setNudgedBack(true);
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
            <Icon id='hail' icon={partner.can_nudge_back && !nudgedBack ? HailActiveIcon : HailIcon} />
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

const NudgesPage: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const [partners, setPartners] = useState<ApiNudgePartner[]>([]);
  const [loading, setLoading] = useState(true);

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
      const data = await apiGetNudgePartners();
      if (data.accounts?.length) dispatch(importFetchedAccounts(data.accounts));
      setPartners(data.partners ?? []);
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    dispatch(clearUnreadNudges());
    void load();
  }, [load, dispatch]);

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
