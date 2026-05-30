import { useState, useCallback } from 'react';

import { FormattedMessage } from 'react-intl';

import { Link } from 'react-router-dom';

import PartnerExchangeIcon from '@/material-icons/400-24px/partner_exchange-fill.svg?react';
import { openModal } from 'mastodon/actions/modal';
import { decrementNudgeCount } from 'mastodon/actions/notification_groups';
import { Button } from 'mastodon/components/button';
import type { NotificationGroupNudge } from 'mastodon/models/notification_group';
import { useAppDispatch } from 'mastodon/store';

import type { LabelRenderer } from './notification_group_with_status';
import { NotificationGroupWithStatus } from './notification_group_with_status';

const labelRenderer: LabelRenderer = (displayedName, total, seeMoreHref) => {
  if (total === 1)
    return (
      <FormattedMessage
        id='notification.nudge'
        defaultMessage='{name} has nudged you'
        values={{ name: displayedName }}
      />
    );

  return (
    <FormattedMessage
      id='notification.nudge.name_and_others'
      defaultMessage='{name} and <a>{count, plural, one {# other} other {# others}}</a> have nudged you'
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
  const dispatch = useAppDispatch();
  const [nudgedBack, setNudgedBack] = useState(false);
  const [streak, setStreak] = useState(notification.nudgeStreak);

  const senderId = notification.sampleAccountIds[0];

  const handleNudgeBack = useCallback(() => {
    if (!senderId || nudgedBack) return;
    dispatch(
      openModal({
        modalType: 'NUDGE_COMPOSE',
        modalProps: {
          accountId: senderId,
          onSent: (newStreak: number) => {
            setStreak(newStreak);
            setNudgedBack(true);
            dispatch(decrementNudgeCount());
          },
        },
      }),
    );
  }, [senderId, nudgedBack, dispatch]);

  const actions =
    notification.sampleAccountIds.length === 1 ? (
      <Button compact disabled={nudgedBack} onClick={handleNudgeBack}>
        {nudgedBack ? (
          <FormattedMessage
            id='notification.nudge.nudged_back'
            defaultMessage='Nudged!'
          />
        ) : (
          <FormattedMessage
            id='notification.nudge.nudge_back'
            defaultMessage='Nudge back'
          />
        )}
      </Button>
    ) : undefined;

  const { nudgeMessage } = notification;
  const hasExtra =
    streak > 0 || !!nudgeMessage?.body || !!nudgeMessage?.mediaUrl;

  const additionalContent = hasExtra ? (
    <>
      {streak > 0 && (
        <span className='notification-nudge__streak'>
          <FormattedMessage
            id='notification.nudge.streak'
            defaultMessage='{count, plural, one {# nudge} other {# nudges}} exchanged'
            values={{ count: streak }}
          />
        </span>
      )}
      {nudgeMessage?.body && (
        <p className='notification-nudge__message'>{nudgeMessage.body}</p>
      )}
      {nudgeMessage?.mediaUrl && (
        <img
          src={nudgeMessage.mediaUrl}
          alt=''
          className='notification-nudge__media'
        />
      )}
    </>
  ) : undefined;

  return (
    <NotificationGroupWithStatus
      type='nudge'
      icon={PartnerExchangeIcon}
      iconId='partner_exchange'
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
