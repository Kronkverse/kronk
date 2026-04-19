import { useEffect, useState, useCallback } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import PersonAlertIcon from '@/material-icons/400-24px/person_alert-fill.svg?react';
import { apiRequestGet } from 'mastodon/api';
import type { ApiNotificationGroupJSON } from 'mastodon/api_types/notifications';
import { importFetchedAccounts } from 'mastodon/actions/importer';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { Icon } from 'mastodon/components/icon';
import ScrollableList from 'mastodon/components/scrollable_list';
import {
  createNotificationGroupFromJSON,
  type NotificationGroupNudge,
} from 'mastodon/models/notification_group';
import { useAppDispatch } from 'mastodon/store';

import { NotificationNudge } from '../notifications_v2/components/notification_nudge';

const messages = defineMessages({
  title: { id: 'nudges.title', defaultMessage: 'Nudges' },
});

const NudgesPage: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const [nudgeGroups, setNudgeGroups] = useState<NotificationGroupNudge[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequestGet<{
        accounts: Parameters<typeof importFetchedAccounts>[0];
        notification_groups: ApiNotificationGroupJSON[];
      }>('v2/notifications', { types: ['nudge'], limit: 40 });

      if (data.accounts) {
        dispatch(importFetchedAccounts(data.accounts));
      }

      const groups = (data.notification_groups ?? [])
        .map(createNotificationGroupFromJSON)
        .filter((g): g is NotificationGroupNudge => g.type === 'nudge');

      setNudgeGroups(groups);
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
        icon='person_alert'
        iconComponent={PersonAlertIcon}
        title={intl.formatMessage(messages.title)}
        multiColumn={multiColumn}
        showBackButton
      />

      <ScrollableList
        scrollKey='nudges'
        isLoading={loading}
        showLoading={loading}
        emptyMessage={
          <div className='empty-column-indicator'>
            <Icon id='person_alert' icon={PersonAlertIcon} />
            <FormattedMessage
              id='nudges.empty'
              defaultMessage="You haven't been nudged yet."
            />
          </div>
        }
      >
        {nudgeGroups.map((group) => (
          <NotificationNudge key={group.group_key} notification={group} unread={false} />
        ))}
      </ScrollableList>

      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>
    </Column>
  );
};

export default NudgesPage;
