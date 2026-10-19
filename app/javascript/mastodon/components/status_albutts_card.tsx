import { defineMessages, useIntl } from 'react-intl';

import PhotoLibraryIcon from '@/material-icons/400-24px/photo_library.svg?react';

import { CardTitle, CardMeta } from './standard_card';
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
  added: {
    id: 'status_albutts_card.added',
    defaultMessage:
      '{count, plural, one {Added a photo} other {Added # photos}}',
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
        <CardTitle className='status-albutts-card__title'>
          {album.title}
        </CardTitle>
        <CardMeta className='status-albutts-card__meta'>
          {intl.formatMessage(messages.photos, { count: album.photo_count })}
          {' · '}
          {intl.formatMessage(messages.contributors, {
            count: album.contributor_count,
          })}
        </CardMeta>
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

interface PhotoBatch {
  id: string;
  photos_count: number;
  previews: { id: string; url: string }[];
  album: { id: string; title: string };
}

// A burst of photos someone added to an album, as one post: "Added 20
// photos" to <album>, with a few of them (docs/spaces/albutts.md, Feed
// projection). Who added them is the post's own header.
export const StatusAlbuttsAddedCard: React.FC<{ batch: PhotoBatch }> = ({
  batch,
}) => {
  const intl = useIntl();

  return (
    <StatusKornerCard
      korner='Albutts'
      variant='album'
      className='status-albutts-card status-albutts-card--added'
      to={`/hub/albutts/albums/${batch.album.id}`}
      badge={{
        icon: PhotoLibraryIcon,
        iconId: 'photo_library',
        label: intl.formatMessage(messages.badge),
      }}
    >
      {batch.previews.length > 0 && (
        <div
          className={`status-albutts-card__strip status-albutts-card__strip--${Math.min(batch.previews.length, 4)}`}
        >
          {batch.previews.map((photo) => (
            <img
              key={photo.id}
              className='status-albutts-card__strip-img'
              src={photo.url}
              alt=''
              loading='lazy'
            />
          ))}
        </div>
      )}

      <div className='status-korner-card__body status-albutts-card__body'>
        <CardTitle className='status-albutts-card__title'>
          {batch.album.title}
        </CardTitle>
        <CardMeta className='status-albutts-card__meta'>
          {intl.formatMessage(messages.added, { count: batch.photos_count })}
        </CardMeta>
      </div>
    </StatusKornerCard>
  );
};
