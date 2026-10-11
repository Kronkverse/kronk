import { useCallback, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import classNames from 'classnames';

import ChevronLeftIcon from '@/material-icons/400-24px/chevron_left.svg?react';
import ChevronRightIcon from '@/material-icons/400-24px/chevron_right.svg?react';
import type { ApiListingPhotoJSON } from 'mastodon/api_types/wachuneed';
import { Icon } from 'mastodon/components/icon';

// A listing's photos as one sideways strip: swipe on touch, arrows with a
// pointer, a "2 / 5" count when there is more than one. Used by the feed
// card (so the photos can be looked through without leaving the feed) and
// by the listing page.
//
// The strip is a native horizontal scroller, which is what lets it sit
// inside a whole-card link and inside the home feed's <FeedDrum>: a drag
// scrolls it and is not a click, and the drum leaves sideways swipes alone
// when they start on something that scrolls sideways. The arrows are real
// buttons, so they stop their own events reaching the card link.

const messages = defineMessages({
  previous: { id: 'listing_photos.previous', defaultMessage: 'Previous photo' },
  next: { id: 'listing_photos.next', defaultMessage: 'Next photo' },
  count: {
    id: 'listing_photos.count',
    defaultMessage: '{current} / {total}',
  },
});

const stop = (e: React.SyntheticEvent) => {
  e.stopPropagation();
};

interface Props {
  photos: ApiListingPhotoJSON[];
  // The listing page shows the originals, uncropped; the feed card shows
  // the small variants, cropped to one shape so cards line up.
  full?: boolean;
  className?: string;
}

export const ListingPhotos: React.FC<Props> = ({ photos, full, className }) => {
  const intl = useIntl();
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const handleScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    setIndex(Math.round(track.scrollLeft / track.clientWidth));
  }, []);

  const step = useCallback((e: React.MouseEvent, by: number) => {
    e.preventDefault();
    e.stopPropagation();
    const track = trackRef.current;
    if (!track) return;
    const current = Math.round(track.scrollLeft / track.clientWidth);
    track.scrollTo({
      left: (current + by) * track.clientWidth,
      behavior: 'smooth',
    });
  }, []);
  const handlePrevious = useCallback(
    (e: React.MouseEvent) => {
      step(e, -1);
    },
    [step],
  );
  const handleNext = useCallback(
    (e: React.MouseEvent) => {
      step(e, 1);
    },
    [step],
  );

  if (photos.length === 0) return null;

  const many = photos.length > 1;

  return (
    <div
      className={classNames('listing-photos', className, {
        'listing-photos--full': full,
      })}
    >
      <div
        className='listing-photos__track'
        ref={trackRef}
        onScroll={handleScroll}
      >
        {photos.map((photo, i) => (
          <img
            key={photo.id}
            className='listing-photos__photo'
            src={full ? (photo.full_url ?? photo.url) : photo.url}
            alt=''
            loading={i === 0 ? undefined : 'lazy'}
            draggable={false}
          />
        ))}
      </div>

      {many && index > 0 && (
        <button
          type='button'
          className='listing-photos__step listing-photos__step--previous'
          onClick={handlePrevious}
          onKeyDown={stop}
          aria-label={intl.formatMessage(messages.previous)}
        >
          <Icon id='chevron_left' icon={ChevronLeftIcon} />
        </button>
      )}
      {many && index < photos.length - 1 && (
        <button
          type='button'
          className='listing-photos__step listing-photos__step--next'
          onClick={handleNext}
          onKeyDown={stop}
          aria-label={intl.formatMessage(messages.next)}
        >
          <Icon id='chevron_right' icon={ChevronRightIcon} />
        </button>
      )}
      {many && (
        <span className='listing-photos__count'>
          {intl.formatMessage(messages.count, {
            current: index + 1,
            total: photos.length,
          })}
        </span>
      )}
    </div>
  );
};
