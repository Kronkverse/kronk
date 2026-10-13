import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type {
  ApiPinnedKuestionJSON,
  KuestionTileSize,
} from 'mastodon/api_types/kuestions';

import type { ArrangeItem, SortableBind } from './arrange_group';
import { ArrangeGroup } from './arrange_group';
import {
  linkHref,
  linkLabel,
  LongtextValue,
  toChips,
} from './profile_fields_display';

// Pinned answers to profile Kuestions members wrote, under the Identity
// lines. Unlike Kronk's own, the question is part of the answer ("Favourite
// tree?" → "Oak"), so each is a tile with both, at the size its owner set.
// In Arrange they drag to reorder and size from the button on the tile,
// like the board's other tiles.

const messages = defineMessages({
  size: {
    id: 'profile_shelves.arrange.size',
    defaultMessage: 'Size: {size}. Tap to change.',
  },
});

const SIZES: KuestionTileSize[] = ['s', 'm', 'l', 'xl'];

// The next size up, wrapping. A paragraph never goes below `m`: at `s` it
// would be a few words in a sliver.
export const nextTileSize = (pin: ApiPinnedKuestionJSON): KuestionTileSize => {
  const allowed = pin.answer_format === 'longtext' ? SIZES.slice(1) : SIZES;
  const current = pin.size ?? 'm';
  return allowed[(allowed.indexOf(current) + 1) % allowed.length] ?? 'm';
};

// Pinned answers have one order but show in several runs. Put the answers
// in `ids` (one run, in its new order) into the slots those answers held,
// leaving every other answer where it was.
export const reorderWithin = <T extends { question_id: string }>(
  pins: T[],
  ids: string[],
): T[] => {
  const byId = new Map(pins.map((pin) => [pin.question_id, pin]));
  const moving = new Set(ids);
  let next = 0;
  return pins.map((pin) => {
    if (!moving.has(pin.question_id)) return pin;
    const placed = byId.get(ids[next] ?? '');
    next += 1;
    return placed ?? pin;
  });
};

const SizeButton: React.FC<{
  pin: ApiPinnedKuestionJSON;
  onResize: (pin: ApiPinnedKuestionJSON) => void;
}> = ({ pin, onResize }) => {
  const intl = useIntl();
  const size = (pin.size ?? 'm').toUpperCase();
  const handleClick = useCallback(() => {
    onResize(pin);
  }, [onResize, pin]);
  // Keep a press on the button from starting a drag of the tile.
  const swallow = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <button
      type='button'
      className='profile-board__size'
      onPointerDown={swallow}
      onClick={handleClick}
      aria-label={intl.formatMessage(messages.size, { size })}
    >
      {size}
    </button>
  );
};

const PinnedAnswer: React.FC<{ pin: ApiPinnedKuestionJSON }> = ({ pin }) => {
  const intl = useIntl();

  switch (pin.answer_format) {
    case 'longtext':
      return <LongtextValue text={pin.body} />;
    case 'list':
      return (
        <div className='profile-identity__chips'>
          {toChips(pin.body).map((chip) => (
            <span className='profile-identity__chip' key={chip}>
              {chip}
            </span>
          ))}
        </div>
      );
    case 'link':
      return (
        <a
          className='profile-identity__link'
          href={linkHref(pin.body)}
          target='_blank'
          rel='noopener noreferrer'
        >
          {linkLabel(pin.body)}
        </a>
      );
    case 'date':
      return (
        <span>
          {intl.formatDate(`${pin.body}T00:00:00Z`, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
          })}
        </span>
      );
    default:
      return <span>{pin.body}</span>;
  }
};

interface TilesProps {
  pins: ApiPinnedKuestionJSON[];
  arrange?: boolean;
  onReorder?: (ids: string[]) => void;
  onResize?: (pin: ApiPinnedKuestionJSON) => void;
}

export const ProfileKuestionTiles: React.FC<TilesProps> = ({
  pins,
  arrange = false,
  onReorder,
  onResize,
}) => {
  const items: ArrangeItem[] = pins
    .filter((pin) => !pin.seed_key && pin.body.trim() !== '')
    .map((pin) => ({
      id: pin.question_id,
      render: (bind?: SortableBind) => {
        const className = `profile-board__tile profile-board__tile--${pin.size ?? 'm'} profile-kuestion-tiles__tile${
          bind?.lifted ? ' profile-board__tile--lifted' : ''
        }`;
        return (
          <div
            className={className}
            ref={bind?.ref}
            style={bind?.style}
            {...bind?.handlers}
          >
            <p className='profile-kuestion-tiles__q'>{pin.title}</p>
            <div className='profile-kuestion-tiles__a'>
              <PinnedAnswer pin={pin} />
            </div>
            {bind && onResize && <SizeButton pin={pin} onResize={onResize} />}
          </div>
        );
      },
    }));

  return (
    <ArrangeGroup
      className={`profile-board profile-kuestion-tiles${arrange ? ' profile-board--arrange' : ''}`}
      items={items}
      arrange={arrange}
      onReorder={onReorder}
    />
  );
};
