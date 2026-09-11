import { defineMessages, useIntl } from 'react-intl';

import MovieIcon from '@/material-icons/400-24px/movie.svg?react';
import PlayArrowIcon from '@/material-icons/400-24px/play_arrow.svg?react';
import { Icon } from 'mastodon/components/icon';
import { StatusKornerCard } from 'mastodon/components/status_korner_card';

const messages = defineMessages({
  badge: {
    id: 'status_cinema_card.badge',
    defaultMessage: 'FILM',
  },
  play: {
    id: 'status_cinema_card.play',
    defaultMessage: 'Play',
  },
});

interface FilmSummary {
  id: string;
  title: string;
  visibility: 'public' | 'mates' | 'orbit' | 'self_only';
  video_url: string | null;
  owner_acct: string;
}

export const StatusCinemaCard: React.FC<{ film: FilmSummary }> = ({ film }) => {
  const intl = useIntl();

  return (
    <StatusKornerCard
      korner='Cinema'
      variant='film'
      className='status-cinema-card'
      to={`/hub/cinema/${film.id}`}
      badge={{
        icon: MovieIcon,
        iconId: 'movie',
        label: intl.formatMessage(messages.badge),
      }}
    >
      <div className='status-cinema-card__poster'>
        <div
          className='status-cinema-card__play'
          aria-label={intl.formatMessage(messages.play)}
        >
          <Icon id='play_arrow' icon={PlayArrowIcon} />
        </div>
      </div>

      <div className='status-korner-card__body status-cinema-card__body'>
        <div className='status-cinema-card__title'>{film.title}</div>
        <div className='status-cinema-card__owner'>@{film.owner_acct}</div>
      </div>
    </StatusKornerCard>
  );
};
