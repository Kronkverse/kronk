import { FormattedMessage } from 'react-intl';

import { Link } from 'react-router-dom';

import TagIcon from '@/material-icons/400-24px/tag.svg?react';
import type { NotificationGroupMediaTag } from 'mastodon/models/notification_group';

import type { LabelRenderer } from './notification_group_with_status';
import { NotificationGroupWithStatus } from './notification_group_with_status';

const labelRenderer: LabelRenderer = (displayedName, total, seeMoreHref) => {
  if (total === 1)
    return (
      <FormattedMessage
        id='notification.media_tag'
        defaultMessage='{name} tagged you in a photo'
        values={{ name: displayedName }}
      />
    );

  return (
    <FormattedMessage
      id='notification.media_tag.name_and_others'
      defaultMessage='{name} and <a>{count, plural, one {# other} other {# others}}</a> tagged you in photos'
      values={{
        name: displayedName,
        count: total - 1,
        a: (chunks) =>
          seeMoreHref ? <Link to={seeMoreHref}>{chunks}</Link> : chunks,
      }}
    />
  );
};

export const NotificationMediaTag: React.FC<{
  notification: NotificationGroupMediaTag;
  unread: boolean;
}> = ({ notification, unread }) => {
  const { mediaTagPreviewUrl, mediaTagStatusPath } = notification;

  const additionalContent = mediaTagPreviewUrl ? (
    mediaTagStatusPath ? (
      <Link
        to={mediaTagStatusPath}
        className='notification-media-tag__preview-link'
      >
        <img
          src={mediaTagPreviewUrl}
          alt=''
          className='notification-media-tag__preview'
        />
      </Link>
    ) : (
      <img
        src={mediaTagPreviewUrl}
        alt=''
        className='notification-media-tag__preview'
      />
    )
  ) : undefined;

  return (
    <NotificationGroupWithStatus
      type='media_tag'
      icon={TagIcon}
      iconId='tag'
      accountIds={notification.sampleAccountIds}
      timestamp={notification.latest_page_notification_at}
      count={notification.notifications_count}
      labelRenderer={labelRenderer}
      unread={unread}
      additionalContent={additionalContent}
    />
  );
};
