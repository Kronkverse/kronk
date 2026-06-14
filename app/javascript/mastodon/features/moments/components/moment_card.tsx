import { defineMessages, useIntl, FormattedRelativeTime } from 'react-intl';

import type { ApiStatusJSON } from 'mastodon/api_types/statuses';

const messages = defineMessages({
  expires: {
    id: 'moments.expires_in',
    defaultMessage: 'Expires {time}',
  },
});

export const MomentCard: React.FC<{ moment: ApiStatusJSON }> = ({ moment }) => {
  const intl = useIntl();
  const expiresAt = moment.expires_at ? new Date(moment.expires_at) : null;
  const secondsUntilExpiry = expiresAt
    ? Math.round((expiresAt.getTime() - Date.now()) / 1000)
    : null;

  return (
    <div className='moment-card'>
      {moment.content && (
        <div
          className='moment-card__body'
          dangerouslySetInnerHTML={{ __html: moment.content }}
        />
      )}
      {moment.media_attachments && moment.media_attachments.length > 0 && (
        <div className='moment-card__media'>
          {moment.media_attachments.map((attachment) => (
            <img
              key={attachment.id}
              className='moment-card__image'
              src={attachment.preview_url}
              alt={attachment.description ?? ''}
            />
          ))}
        </div>
      )}
      {secondsUntilExpiry !== null && (
        <div className='moment-card__expiry'>
          {intl.formatMessage(messages.expires, {
            time: (
              <FormattedRelativeTime
                value={secondsUntilExpiry}
                updateIntervalInSeconds={60}
              />
            ),
          })}
        </div>
      )}
    </div>
  );
};
