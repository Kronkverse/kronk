import { defineMessages, useIntl } from 'react-intl';

import MicIcon from '@/material-icons/400-24px/mic.svg?react';

import { CardTitle, CardMeta } from './standard_card';
import { StatusKornerCard } from './status_korner_card';

// A live set's post in the feed (decisions.md, 2026-10-26): the same card
// frame as a Booth set's, saying whether it's live now, when it starts, or
// that it has ended, and opening the room. The post's text is the host's
// own words or the title; the card is the link, so the post carries none.

const messages = defineMessages({
  badge: { id: 'status_booth_live_card.badge', defaultMessage: 'LIVE SET' },
  liveNow: {
    id: 'status_booth_live_card.live_now',
    defaultMessage: 'Live now',
  },
  starts: {
    id: 'status_booth_live_card.starts',
    defaultMessage: 'Starts {when}',
  },
  ended: { id: 'status_booth_live_card.ended', defaultMessage: 'Ended' },
});

interface BoothLiveSummary {
  id: string;
  title: string;
  state: 'scheduled' | 'live' | 'ended';
  starts_at: string;
  started_at?: string | null;
  genres?: string[] | null;
}

export const StatusBoothLiveCard: React.FC<{ live: BoothLiveSummary }> = ({
  live,
}) => {
  const intl = useIntl();

  const when =
    live.state === 'live'
      ? intl.formatMessage(messages.liveNow)
      : live.state === 'ended'
        ? intl.formatMessage(messages.ended)
        : intl.formatMessage(messages.starts, {
            when: intl.formatDate(new Date(live.starts_at), {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              hour: 'numeric',
              minute: '2-digit',
            }),
          });

  const genresLabel =
    live.genres && live.genres.length > 0
      ? live.genres.slice(0, 3).join(' · ')
      : null;

  return (
    <StatusKornerCard
      korner='Booth'
      variant='set'
      className={`status-booth-card status-booth-card--live status-booth-card--${live.state}`}
      to={`/hub/booth/live/${live.id}`}
      badge={{
        icon: MicIcon,
        iconId: 'mic',
        label: intl.formatMessage(messages.badge),
      }}
    >
      <div className='status-korner-card__body'>
        <CardTitle className='status-korner-card__title'>
          {live.title}
        </CardTitle>
        <CardMeta className='status-booth-card__when'>{when}</CardMeta>
      </div>

      {genresLabel && (
        <div className='status-korner-card__footer status-booth-card__footer'>
          <CardMeta className='status-korner-card__meta'>
            <span className='status-booth-card__genres'>{genresLabel}</span>
          </CardMeta>
        </div>
      )}
    </StatusKornerCard>
  );
};
