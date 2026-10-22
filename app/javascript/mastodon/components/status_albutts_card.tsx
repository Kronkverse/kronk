import { defineMessages, useIntl } from 'react-intl';

import PhotoLibraryIcon from '@/material-icons/400-24px/photo_library.svg?react';

import { AvatarStack } from './avatar_stack';
import type { StackedFace } from './avatar_stack';
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

interface AlbumSummary {
  id: string;
  title: string;
  visibility: 'public' | 'mates' | 'krew';
  photo_count: number;
  contributor_count: number;
  cover_url: string | null;
  contributor_avatars: StackedFace[];
  // Photos besides the cover (two at most). Older posts carry none.
  preview_urls?: string[];
}

export const StatusAlbuttsCard: React.FC<{ album: AlbumSummary }> = ({
  album,
}) => {
  const intl = useIntl();
  const previews = (album.preview_urls ?? []).slice(0, 2);

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
        // The cover, and beside it a couple more of the album's photos: an
        // album is many pictures, so the card shows more than one.
        <div
          className={`status-albutts-card__cover status-albutts-card__mosaic status-albutts-card__mosaic--${1 + previews.length}`}
          aria-hidden
        >
          <img src={album.cover_url} alt='' loading='lazy' />
          {previews.map((url) => (
            <img key={url} src={url} alt='' loading='lazy' />
          ))}
        </div>
      )}

      <div className='status-korner-card__body status-albutts-card__body'>
        <CardTitle className='status-albutts-card__title'>
          {album.title}
        </CardTitle>
        <CardMeta className='status-albutts-card__meta'>
          {/* Who's building it, as their faces rather than a count. */}
          <AvatarStack
            faces={album.contributor_avatars}
            total={album.contributor_count}
            label={intl.formatMessage(messages.contributors, {
              count: album.contributor_count,
            })}
          />
          <span>
            {intl.formatMessage(messages.photos, { count: album.photo_count })}
          </span>
        </CardMeta>
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
          {batch.previews.map((photo, i) => (
            <span key={photo.id} className='status-albutts-card__strip-tile'>
              <img
                className='status-albutts-card__strip-img'
                src={photo.url}
                alt=''
                loading='lazy'
              />
              {/* More were added than fit: the last tile says how many. */}
              {i === batch.previews.length - 1 &&
                batch.photos_count > batch.previews.length && (
                  <span className='status-albutts-card__strip-more'>
                    +{batch.photos_count - batch.previews.length}
                  </span>
                )}
            </span>
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
