// Moments — the feed-projection card. Compact by design: a Moment's
// primary content lives in the media attachment already surfaced by
// Status; the card carries a small "ephemeral" badge + expiry hint +
// froth count. Tapping the card jumps to /hub/moments/<id> for the
// full viewer.

import { defineMessages, FormattedRelativeTime, useIntl } from 'react-intl';

import HourglassIcon from '@/material-icons/400-24px/hourglass.svg?react';

import { StatusKornerCard } from './status_korner_card';

const messages = defineMessages({
  badge: { id: 'status_moment_card.badge', defaultMessage: 'MOMENT' },
  froths: {
    id: 'status_moment_card.froths',
    defaultMessage:
      '{count, plural, =0 {No froths yet} one {# froth} other {# froths}}',
  },
  expiresIn: {
    id: 'status_moment_card.expires_in',
    defaultMessage: 'Gone {when}',
  },
});

interface MomentSummary {
  id: string;
  caption: string | null;
  expires_at: string;
  active: boolean;
  froth_count: number;
}

const momentPath = (id: string) => `/hub/moments/${id}`;

export const StatusMomentCard = ({ moment }: { moment: MomentSummary }) => {
  const intl = useIntl();
  const expiresAt = new Date(moment.expires_at);
  const secondsUntilExpiry = Math.round(
    (expiresAt.getTime() - Date.now()) / 1000,
  );

  return (
    <StatusKornerCard
      korner='moments'
      className='status-moment-card'
      badge={{
        icon: HourglassIcon,
        iconId: 'hourglass',
        label: intl.formatMessage(messages.badge),
      }}
      to={momentPath(moment.id)}
    >
      <div className='status-moment-card__body'>
        {moment.caption && (
          <div className='status-moment-card__caption'>{moment.caption}</div>
        )}
        <div className='status-moment-card__meta'>
          {moment.active ? (
            <span className='status-moment-card__expires'>
              {intl.formatMessage(messages.expiresIn, {
                when: (
                  <FormattedRelativeTime
                    value={secondsUntilExpiry}
                    numeric='auto'
                    updateIntervalInSeconds={60}
                  />
                ),
              })}
            </span>
          ) : (
            <span className='status-moment-card__expired'>—</span>
          )}
          <span className='status-moment-card__froths'>
            {intl.formatMessage(messages.froths, { count: moment.froth_count })}
          </span>
        </div>
      </div>
    </StatusKornerCard>
  );
};
