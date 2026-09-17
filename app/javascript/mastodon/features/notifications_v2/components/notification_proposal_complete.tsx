import { FormattedMessage } from 'react-intl';

import { Link } from 'react-router-dom';

import DoneAllIcon from '@/material-icons/400-24px/done_all.svg?react';
import { Icon } from 'mastodon/components/icon';
import type { NotificationGroupProposalComplete } from 'mastodon/models/notification_group';

import type { LabelRenderer } from './notification_group_with_status';
import { NotificationGroupWithStatus } from './notification_group_with_status';

const labelRenderer: LabelRenderer = (displayedName, total) => {
  if (total === 1)
    return (
      <FormattedMessage
        id='notification.proposal_complete'
        defaultMessage='{name} completed the work on your proposal'
        values={{ name: displayedName }}
      />
    );

  return (
    <FormattedMessage
      id='notification.proposal_complete.name_and_others'
      defaultMessage='{name} and {count, plural, one {# other} other {# others}} completed the work on your proposal'
      values={{
        name: displayedName,
        count: total - 1,
      }}
    />
  );
};

export const NotificationProposalComplete: React.FC<{
  notification: NotificationGroupProposalComplete;
  unread: boolean;
}> = ({ notification, unread }) => {
  const proposal = notification.proposal;

  if (!proposal) return null;

  return (
    <NotificationGroupWithStatus
      type='proposal_status_changed'
      icon={DoneAllIcon}
      iconId='done_all'
      accountIds={notification.sampleAccountIds}
      timestamp={notification.latest_page_notification_at}
      count={notification.notifications_count}
      labelRenderer={labelRenderer}
      unread={unread}
      additionalContent={
        // Reuses the shared notification card styling from the event
        // invitation renderer — same bordered title + meta card.
        <Link
          to={`/hub/kommons/p/${proposal.proposal_id}`}
          className='notification-event-card'
        >
          <div className='notification-event-card__info'>
            <div className='notification-event-card__title'>
              <Icon id='done_all' icon={DoneAllIcon} />
              {proposal.proposal_title}
            </div>
            <div className='notification-event-card__meta'>
              <FormattedMessage
                id='notification.proposal_complete.ready'
                defaultMessage='Ready to finalise'
              />
            </div>
          </div>
        </Link>
      }
    />
  );
};
