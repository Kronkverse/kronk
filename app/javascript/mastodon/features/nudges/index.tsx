import { useEffect, useState, useCallback } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';

import HailActiveIcon from '@/material-icons/400-24px/hail-fill.svg?react';
import { apiRequestGet } from 'mastodon/api';
import type { ApiNotificationGroupJSON } from 'mastodon/api_types/notifications';
import { importFetchedAccounts } from 'mastodon/actions/importer';
import { apiGetNudgePartners } from 'mastodon/api/accounts';
import type { ApiNudgePartner } from 'mastodon/api/accounts';
import { Avatar } from 'mastodon/components/avatar';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { DisplayName } from 'mastodon/components/display_name';
import ScrollableList from 'mastodon/components/scrollable_list';
import {
  createNotificationGroupFromJSON,
  type NotificationGroupNudge,
} from 'mastodon/models/notification_group';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

import { NotificationNudge } from '../notifications_v2/components/notification_nudge';

const messages = defineMessages({
  title: { id: 'nudges.title', defaultMessage: 'Nudges' },
});

const NudgePartnerItem: React.FC<{ partner: ApiNudgePartner }> = ({
  partner,
}) => {
  const account = useAppSelector((state) =>
    state.accounts.get(partner.account_id),
  );

  if (!account) return null;

  return (
    <Link to={`/@${account.acct}/nudges`} className='nudge-partner'>
      <Avatar account={account} size={36} />
      <div className='nudge-partner__info'>
        <DisplayName account={account} />
        <span className='nudge-partner__count'>
          <FormattedMessage
            id='nudges.sent_count'
            defaultMessage='{count, plural, one {nudged # time} other {nudged # times}}'
            values={{ count: partner.sent_count }}
          />
        </span>
      </div>
    </Link>
  );
};

const NudgesPage: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const [nudgeGroups, setNudgeGroups] = useState<NotificationGroupNudge[]>([]);
  const [partners, setPartners] = useState<ApiNudgePartner[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [notifData, partnerData] = await Promise.all([
        apiRequestGet<{
          accounts: Parameters<typeof importFetchedAccounts>[0];
          notification_groups: ApiNotificationGroupJSON[];
        }>('v2/notifications', { types: ['nudge'], limit: 40 }),
        apiGetNudgePartners(),
      ]);

      const allAccounts = [
        ...(notifData.accounts ?? []),
        ...(partnerData.accounts ?? []),
      ];
      if (allAccounts.length) dispatch(importFetchedAccounts(allAccounts));

      const groups = (notifData.notification_groups ?? [])
        .map(createNotificationGroupFromJSON)
        .filter((g): g is NotificationGroupNudge => g.type === 'nudge');

      setNudgeGroups(groups);
      setPartners(partnerData.partners ?? []);
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
        {partners.length > 0 && (
          <div className='nudges__partners'>
            <h4 className='nudges__partners-heading'>
              <FormattedMessage
                id='nudges.partners_heading'
                defaultMessage="You've nudged"
              />
            </h4>
            {partners.map((p) => (
              <NudgePartnerItem key={p.account_id} partner={p} />
            ))}
          </div>
        )}

        <ScrollableList
          scrollKey='nudges'
          isLoading={loading}
          showLoading={loading}
          emptyMessage={
            partners.length === 0 ? (
              <div className='empty-column-indicator'>
                <FormattedMessage
                  id='nudges.empty'
                  defaultMessage="You haven't been nudged yet."
                />
              </div>
            ) : undefined
          }
        >
          {nudgeGroups.map((group) => (
            <NotificationNudge
              key={group.group_key}
              notification={group}
              unread={false}
            />
          ))}
        </ScrollableList>
      </div>

      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>
    </Column>
  );
};

export default NudgesPage;
