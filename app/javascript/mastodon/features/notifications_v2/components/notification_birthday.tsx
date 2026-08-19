import { FormattedMessage } from 'react-intl';

import CelebrationIcon from '@/material-icons/400-24px/celebration-fill.svg?react';
import type { NotificationGroupBirthday } from 'mastodon/models/notification_group';

import type { LabelRenderer } from './notification_group_with_status';
import { NotificationGroupWithStatus } from './notification_group_with_status';

const labelRenderer: LabelRenderer = (displayedName, total) => {
  if (total === 1)
    return (
      <FormattedMessage
        id='notification.birthday'
        defaultMessage="It's {name}'s birthday"
        values={{ name: displayedName }}
      />
    );

  return (
    <FormattedMessage
      id='notification.birthday.name_and_others'
      defaultMessage="It's {name} and {count, plural, one {# other} other {# others}}'s birthday"
      values={{
        name: displayedName,
        count: total - 1,
      }}
    />
  );
};

export const NotificationBirthday: React.FC<{
  notification: NotificationGroupBirthday;
  unread: boolean;
}> = ({ notification, unread }) => (
  <NotificationGroupWithStatus
    type='birthday'
    icon={CelebrationIcon}
    iconId='celebration'
    accountIds={notification.sampleAccountIds}
    timestamp={notification.latest_page_notification_at}
    count={notification.notifications_count}
    labelRenderer={labelRenderer}
    unread={unread}
  />
);
