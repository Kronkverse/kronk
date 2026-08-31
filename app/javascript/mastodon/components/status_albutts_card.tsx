import { defineMessages, useIntl } from 'react-intl';

import PhotoLibraryIcon from '@/material-icons/400-24px/photo_library.svg?react';

import { StatusKornerCard } from './status_korner_card';

const messages = defineMessages({
  badge: {
    id: 'status_albutts_card.badge',
    defaultMessage: 'ALBUM',
  },
  photos: {
    id: 'status_albutts_card.photos',
    defaultMessage: '{count, plural, one {# photo} other {# photos}}',
  },
  contributors: {
    id: 'status_albutts_card.contributors',
    defaultMessage:
      '{count, plural, one {# contributor} other {# contributors}}',
  },
});

interface ContributorAvatar {
  id: string;
  acct: string;
  avatar: string;
}

interface AlbumSummary {
  id: string;
  title: string;
  visibility: 'public' | 'mates' | 'krew';
  photo_count: number;
  contributor_count: number;
  cover_url: string | null;
  contributor_avatars: ContributorAvatar[];
}

export const StatusAlbuttsCard: React.FC<{ album: AlbumSummary }> = ({
  album,
}) => {
  const intl = useIntl();

  return (
    <StatusKornerCard
      korner='Albutts'
      variant='album'
      className='status-albutts-card'
      to={`/hub/albutts/albums/${album.id}`}
      badge={{
        icon: PhotoLibraryIcon,
        iconId: 'photo_library',
        label: intl.formatMessage(messages.badge),
      }}
    >
      {album.cover_url && (
        <div
          className='status-albutts-card__cover'
          style={{ backgroundImage: `url(${album.cover_url})` }}
          aria-hidden
        />
      )}

      <div className='status-korner-card__body status-albutts-card__body'>
        <div className='status-albutts-card__title'>{album.title}</div>
        <div className='status-albutts-card__meta'>
          {intl.formatMessage(messages.photos, { count: album.photo_count })}
          {' · '}
          {intl.formatMessage(messages.contributors, {
            count: album.contributor_count,
          })}
        </div>
      </div>

      <div className='status-korner-card__footer status-albutts-card__footer'>
        {album.contributor_avatars.length > 0 && (
          <div className='status-albutts-card__avatars'>
            {album.contributor_avatars.slice(0, 5).map((a) => (
              <img
                key={a.id}
                className='status-albutts-card__avatar'
                src={a.avatar}
                alt={a.acct}
              />
            ))}
          </div>
        )}
        {/* Redundant "View" text CTA retired 2026-08-31 — the whole
            card is already the tap target (see StatusKornerCard `to`).
            Contributor avatars stay; they carry information. */}
      </div>
    </StatusKornerCard>
  );
};
