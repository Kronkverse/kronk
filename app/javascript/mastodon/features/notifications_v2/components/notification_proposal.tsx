import { FormattedMessage } from 'react-intl';

import { Link } from 'react-router-dom';

import BalanceIcon from '@/material-icons/400-24px/gavel.svg?react';
import type { NotificationGroupProposal } from 'mastodon/models/notification_group';

import type { LabelRenderer } from './notification_group_with_status';
import { NotificationGroupWithStatus } from './notification_group_with_status';

const labelFor = (type: NotificationGroupProposal['type']): LabelRenderer => {
  return (displayedName, total) => {
    if (type === 'proposal_support') {
      if (total === 1) {
        return (
          <FormattedMessage
            id='notification.proposal_support'
            defaultMessage='{name} supported your seed'
            values={{ name: displayedName }}
          />
        );
      }
      return (
        <FormattedMessage
          id='notification.proposal_support.many'
          defaultMessage='{name} and {count, plural, one {# other} other {# others}} supported your seed'
          values={{ name: displayedName, count: total - 1 }}
        />
      );
    }

    if (type === 'proposal_comment') {
      if (total === 1) {
        return (
          <FormattedMessage
            id='notification.proposal_comment'
            defaultMessage='{name} commented on your seed'
            values={{ name: displayedName }}
          />
        );
      }
      return (
        <FormattedMessage
          id='notification.proposal_comment.many'
          defaultMessage='{name} and {count, plural, one {# other} other {# others}} commented on your seed'
          values={{ name: displayedName, count: total - 1 }}
        />
      );
    }

    // proposal_suggest_completed
    if (total === 1) {
      return (
        <FormattedMessage
          id='notification.proposal_suggest_completed'
          defaultMessage='{name} thinks your seed has been delivered'
          values={{ name: displayedName }}
        />
      );
    }
    return (
      <FormattedMessage
        id='notification.proposal_suggest_completed.many'
        defaultMessage='{name} and {count, plural, one {# other} other {# others}} think your seed has been delivered'
        values={{ name: displayedName, count: total - 1 }}
      />
    );
  };
};

export const NotificationProposal: React.FC<{
  notification: NotificationGroupProposal;
  unread: boolean;
}> = ({ notification, unread }) => {
  const { proposal } = notification;
  if (!proposal) return null;

  return (
    <NotificationGroupWithStatus
      type={notification.type}
      icon={BalanceIcon}
      iconId='gavel'
      accountIds={notification.sampleAccountIds}
      timestamp={notification.latest_page_notification_at}
      count={notification.notifications_count}
      labelRenderer={labelFor(notification.type)}
      unread={unread}
      additionalContent={
        <Link
          to={`/governance/${proposal.id}`}
          className='notification-proposal-card'
        >
          <span className='notification-proposal-card__title'>
            {proposal.title}
          </span>
        </Link>
      }
    />
  );
};
