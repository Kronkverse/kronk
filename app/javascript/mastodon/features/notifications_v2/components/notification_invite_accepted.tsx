import { FormattedMessage } from 'react-intl';

import PersonAddIcon from '@/material-icons/400-24px/person_add-fill.svg?react';
import type { NotificationGroupInviteAccepted } from 'mastodon/models/notification_group';

import type { LabelRenderer } from './notification_group_with_status';
import { NotificationGroupWithStatus } from './notification_group_with_status';

const labelRenderer: LabelRenderer = (displayedName, total) => {
  if (total === 1)
    return (
      <FormattedMessage
        id='notification.invite_accepted'
        defaultMessage='{name} joined through your invite'
        values={{ name: displayedName }}
      />
    );

  return (
    <FormattedMessage
      id='notification.invite_accepted.name_and_others'
      defaultMessage='{name} and {count, plural, one {# other} other {# others}} joined through your invite'
      values={{
        name: displayedName,
        count: total - 1,
      }}
    />
  );
};

export const NotificationInviteAccepted: React.FC<{
  notification: NotificationGroupInviteAccepted;
  unread: boolean;
}> = ({ notification, unread }) => (
  <NotificationGroupWithStatus
    type='invite-accepted'
    icon={PersonAddIcon}
    iconId='person-add'
    accountIds={notification.sampleAccountIds}
    timestamp={notification.latest_page_notification_at}
    count={notification.notifications_count}
    labelRenderer={labelRenderer}
    unread={unread}
  />
);
