import { useState, useCallback } from 'react';

import { FormattedMessage } from 'react-intl';

import { Link } from 'react-router-dom';

import { openModal } from 'mastodon/actions/modal';
import { decrementNudgeCount } from 'mastodon/actions/notification_groups';
import { apiGetNudgeThread } from 'mastodon/api/accounts';
import { Button } from 'mastodon/components/button';
import { kornerIcon } from 'mastodon/hooks/useKornerIcon';
import type {
  NotificationGroupNudge,
  NudgeMessageData,
} from 'mastodon/models/notification_group';
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

function revealLabel(msg: NudgeMessageData): React.ReactNode {
  if (msg.voiceUrl && !msg.body && !msg.mediaUrl) {
    return (
      <FormattedMessage
        id='notification.nudge.listen'
        defaultMessage='Listen'
      />
    );
  }
  if (msg.mediaUrl && !msg.body && !msg.voiceUrl) {
    return (
      <FormattedMessage id='notification.nudge.view' defaultMessage='View' />
    );
  }
  return (
    <FormattedMessage
      id='notification.nudge.read'
      defaultMessage='Read message'
    />
  );
}

const NudgeMessageContent: React.FC<{ msg: NudgeMessageData }> = ({ msg }) => (
  <>
    {msg.inReplyTo && (
      <div className='notification-nudge__reply-quote'>
        {msg.inReplyTo.body && (
          <p className='notification-nudge__reply-quote-body'>
            {msg.inReplyTo.body}
          </p>
        )}
        {msg.inReplyTo.mediaUrl && (
          <img
            src={msg.inReplyTo.mediaUrl}
            alt=''
            className='notification-nudge__reply-quote-img'
          />
        )}
      </div>
    )}
    {msg.body && <p className='notification-nudge__message'>{msg.body}</p>}
    {msg.mediaUrl && (
      <img src={msg.mediaUrl} alt='' className='notification-nudge__media' />
    )}
    {msg.voiceUrl && (
      <audio controls className='notification-nudge__voice' src={msg.voiceUrl}>
        <track kind='captions' />
      </audio>
    )}
  </>
);

export const NotificationNudge: React.FC<{
  notification: NotificationGroupNudge;
  unread: boolean;
}> = ({ notification, unread }) => {
  const dispatch = useAppDispatch();
  const [nudgedBack, setNudgedBack] = useState(false);
  const [streak, setStreak] = useState(notification.nudgeStreak);
  const [revealed, setRevealed] = useState(false);
  const [fetchedBody, setFetchedBody] = useState<string | null | undefined>(
    undefined,
  );
  const [loadingMessage, setLoadingMessage] = useState(false);

  const senderId = notification.sampleAccountIds[0];

  const handleNudgeBack = useCallback(() => {
    if (!senderId || nudgedBack) return;
    dispatch(
      openModal({
        modalType: 'NUDGE_COMPOSE',
        modalProps: {
          accountId: senderId,
          inReplyToNotificationId: notification.most_recent_notification_id,
          onSent: (newStreak: number) => {
            setStreak(newStreak);
            setNudgedBack(true);
            dispatch(decrementNudgeCount());
          },
        },
      }),
    );
  }, [
    senderId,
    nudgedBack,
    dispatch,
    notification.most_recent_notification_id,
  ]);

  const handleReveal = useCallback(() => {
    setRevealed(true);
  }, []);

  const handleReadMessage = useCallback(() => {
    if (!senderId || loadingMessage) return;
    setLoadingMessage(true);
    void apiGetNudgeThread(senderId)
      .then((res) => {
        const latest = [...res.messages]
          .filter((m) => m.direction === 'received')
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime(),
          )
          .at(0);
        setFetchedBody(latest?.body ?? null);
      })
      .catch(() => {
        setFetchedBody(null);
      })
      .finally(() => {
        setLoadingMessage(false);
      });
  }, [senderId, loadingMessage]);

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

  const additionalContent = (
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

      {nudgeMessage != null &&
        (nudgeMessage.body ?? nudgeMessage.mediaUrl ?? nudgeMessage.voiceUrl) !=
          null &&
        (revealed ? (
          <NudgeMessageContent msg={nudgeMessage} />
        ) : (
          <button
            type='button'
            className='notification-nudge__reveal-btn'
            onClick={handleReveal}
          >
            {revealLabel(nudgeMessage)}
          </button>
        ))}

      {nudgeMessage == null &&
        notification.sampleAccountIds.length === 1 &&
        (fetchedBody !== undefined ? (
          fetchedBody != null ? (
            <p className='notification-nudge__message'>{fetchedBody}</p>
          ) : null
        ) : (
          <button
            type='button'
            className='notification-nudge__reveal-btn'
            onClick={handleReadMessage}
            disabled={loadingMessage}
          >
            <FormattedMessage
              id='notification.nudge.read'
              defaultMessage='Read message'
            />
          </button>
        ))}
    </>
  );

  return (
    <NotificationGroupWithStatus
      type='nudge'
      icon={kornerIcon('nudges')}
      iconId='nudge'
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
