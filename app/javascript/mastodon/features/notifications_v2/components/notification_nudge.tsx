import { useState, useCallback } from 'react';

import { FormattedMessage } from 'react-intl';

import { Link } from 'react-router-dom';

import PartnerExchangeIcon from '@/material-icons/400-24px/partner_exchange-fill.svg?react';
import { openModal } from 'mastodon/actions/modal';
import { decrementNudgeCount } from 'mastodon/actions/notification_groups';
import { Button } from 'mastodon/components/button';
import type {
  NotificationGroupNudge,
  NudgeReactionEmoji,
  NudgeReactions,
} from 'mastodon/models/notification_group';
import { useAppDispatch } from 'mastodon/store';

import type { LabelRenderer } from './notification_group_with_status';
import { NotificationGroupWithStatus } from './notification_group_with_status';

const REACTION_EMOJI: NudgeReactionEmoji[] = ['❤️', '😂', '🙌', '🔥', '😢'];

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

const NudgeReactionButton: React.FC<{
  emoji: NudgeReactionEmoji;
  count: number;
  me: boolean;
  onReact: (emoji: NudgeReactionEmoji) => void;
}> = ({ emoji, count, me, onReact }) => {
  const handleClick = useCallback(() => {
    onReact(emoji);
  }, [emoji, onReact]);
  return (
    <button
      type='button'
      className={`notification-nudge__reaction${me ? ' notification-nudge__reaction--active' : ''}`}
      onClick={handleClick}
    >
      <span>{emoji}</span>
      {count > 0 && (
        <span className='notification-nudge__reaction-count'>{count}</span>
      )}
    </button>
  );
};

const NudgeReactionBar: React.FC<{
  notificationId: string;
  reactions: NudgeReactions;
}> = ({ notificationId, reactions }) => {
  const [localReactions, setLocalReactions] = useState(reactions);

  const handleReact = useCallback(
    (emoji: NudgeReactionEmoji) => {
      const alreadyReacted = localReactions[emoji].me;
      const url = `/api/v1/notifications/${notificationId}/nudge_react`;

      void (async () => {
        const csrfMeta = document.querySelector<HTMLMetaElement>(
          'meta[name="csrf-token"]',
        );
        const res = await fetch(url, {
          method: alreadyReacted ? 'DELETE' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfMeta?.content ?? '',
          },
          credentials: 'same-origin',
          body: alreadyReacted ? undefined : JSON.stringify({ emoji }),
        });
        if (res.ok) {
          const updated = (await res.json()) as NudgeReactions;
          setLocalReactions(updated);
        }
      })();
    },
    [notificationId, localReactions],
  );

  return (
    <div className='notification-nudge__reactions'>
      {REACTION_EMOJI.map((emoji) => {
        const { count, me } = localReactions[emoji];
        return (
          <NudgeReactionButton
            key={emoji}
            emoji={emoji}
            count={count}
            me={me}
            onReact={handleReact}
          />
        );
      })}
    </div>
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

  const { nudgeMessage, nudgeReactions } = notification;
  const hasExtra =
    streak > 0 ||
    !!nudgeMessage?.body ||
    !!nudgeMessage?.mediaUrl ||
    !!nudgeMessage?.voiceUrl;

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
      {nudgeMessage?.inReplyTo && (
        <div className='notification-nudge__reply-quote'>
          {nudgeMessage.inReplyTo.body && (
            <p className='notification-nudge__reply-quote-body'>
              {nudgeMessage.inReplyTo.body}
            </p>
          )}
          {nudgeMessage.inReplyTo.mediaUrl && (
            <img
              src={nudgeMessage.inReplyTo.mediaUrl}
              alt=''
              className='notification-nudge__reply-quote-img'
            />
          )}
        </div>
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
      {nudgeMessage?.voiceUrl && (
        <audio
          controls
          className='notification-nudge__voice'
          src={nudgeMessage.voiceUrl}
        >
          <track kind='captions' />
        </audio>
      )}
      <NudgeReactionBar
        notificationId={notification.most_recent_notification_id}
        reactions={nudgeReactions}
      />
    </>
  ) : (
    <NudgeReactionBar
      notificationId={notification.most_recent_notification_id}
      reactions={nudgeReactions}
    />
  );

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
