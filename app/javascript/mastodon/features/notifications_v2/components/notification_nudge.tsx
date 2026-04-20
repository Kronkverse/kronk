import { useState, useCallback } from 'react';

import { FormattedMessage } from 'react-intl';

import { Link } from 'react-router-dom';

import HailIcon from '@/material-icons/400-24px/hail-fill.svg?react';
import { apiNudgeAccount } from 'mastodon/api/accounts';
import { Button } from 'mastodon/components/button';
import type { NotificationGroupNudge } from 'mastodon/models/notification_group';

import type { LabelRenderer } from './notification_group_with_status';
import { NotificationGroupWithStatus } from './notification_group_with_status';

const labelRenderer: LabelRenderer = (displayedName, total, seeMoreHref) => {
  if (total === 1)
    return (
      <FormattedMessage
        id='notification.nudge'
        defaultMessage='{name} nudged you'
        values={{ name: displayedName }}
      />
    );

  return (
    <FormattedMessage
      id='notification.nudge.name_and_others'
      defaultMessage='{name} and <a>{count, plural, one {# other} other {# others}}</a> nudged you'
      values={{
        name: displayedName,
        count: total - 1,
        a: (chunks) =>
          seeMoreHref ? <Link to={seeMoreHref}>{chunks}</Link> : chunks,
      }}
    />
  );
};

export const NotificationNudge: React.FC<{
  notification: NotificationGroupNudge;
  unread: boolean;
}> = ({ notification, unread }) => {
  const [loading, setLoading] = useState(false);
  const [nudgedBack, setNudgedBack] = useState(false);
  const [streak, setStreak] = useState(notification.nudgeStreak);

  const senderId = notification.sampleAccountIds[0];

  const handleNudgeBack = useCallback(async () => {
    if (!senderId || loading || nudgedBack) return;
    setLoading(true);
    try {
      const result = await apiNudgeAccount(senderId);
      setStreak(result.streak);
      setNudgedBack(true);
    } finally {
      setLoading(false);
    }
  }, [senderId, loading, nudgedBack]);

  const actions =
    notification.sampleAccountIds.length === 1 ? (
      <Button compact disabled={loading || nudgedBack} onClick={handleNudgeBack}>
        {nudgedBack ? (
          <FormattedMessage id='notification.nudge.nudged_back' defaultMessage='Nudged!' />
        ) : (
          <FormattedMessage id='notification.nudge.nudge_back' defaultMessage='Nudge back' />
        )}
      </Button>
    ) : undefined;

  const additionalContent =
    streak > 0 ? (
      <span className='notification-nudge__streak'>
        🔔{' '}
        <FormattedMessage
          id='notification.nudge.streak'
          defaultMessage='{count, plural, one {# nudge} other {# nudges}} exchanged'
          values={{ count: streak }}
        />
      </span>
    ) : undefined;

  return (
    <NotificationGroupWithStatus
      type='nudge'
      icon={HailIcon}
      iconId='hail'
      accountIds={notification.sampleAccountIds}
      timestamp={notification.latest_page_notification_at}
      count={notification.notifications_count}
      labelRenderer={labelRenderer}
      unread={unread}
      actions={actions}
      additionalContent={additionalContent}
    />
  );
};
