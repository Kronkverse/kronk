import { FormattedMessage } from 'react-intl';

import FavoriteIcon from '@/material-icons/400-24px/favorite-fill.svg?react';
import type { NotificationGroupMomentReaction } from 'mastodon/models/notification_group';
import { useAppSelector } from 'mastodon/store';

import type { LabelRenderer } from './notification_group_with_status';
import { NotificationGroupWithStatus } from './notification_group_with_status';

const labelRenderer: LabelRenderer = (displayedName, total) => {
  if (total === 1)
    return (
      <FormattedMessage
        id='notification.moment_reaction'
        defaultMessage='{name} reacted to your Moment'
        values={{ name: displayedName }}
      />
    );

  return (
    <FormattedMessage
      id='notification.moment_reaction.name_and_others'
      defaultMessage='{name} and {count, plural, one {# other} other {# others}} reacted to your Moment'
      values={{
        name: displayedName,
        count: total - 1,
      }}
    />
  );
};

export const NotificationMomentReaction: React.FC<{
  notification: NotificationGroupMomentReaction;
  unread: boolean;
}> = ({ notification, unread }) => {
  const { statusId } = notification;
  const statusAccount = useAppSelector(
    (state) =>
      state.accounts.get(state.statuses.getIn([statusId, 'account']) as string)
        ?.acct,
  );

  return (
    <NotificationGroupWithStatus
      type='moment_reaction'
      icon={FavoriteIcon}
      iconId='star'
      accountIds={notification.sampleAccountIds}
      statusId={notification.statusId}
      timestamp={notification.latest_page_notification_at}
      count={notification.notifications_count}
      labelRenderer={labelRenderer}
      labelSeeMoreHref={
        statusAccount ? `/@${statusAccount}/${statusId}` : undefined
      }
      unread={unread}
    />
  );
};
