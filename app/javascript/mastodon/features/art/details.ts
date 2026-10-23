import { defineMessages } from 'react-intl';
import type { IntlShape } from 'react-intl';

import type {
  ArtAvailability,
  ArtPieceDetailsJSON,
} from 'mastodon/api_types/art';

// A piece's details as people read them (docs/spaces/art.md, Piece
// details): the facts line on its page ("Oil on linen · 60 × 90 cm · 2026 ·
// Original") and the status a portfolio card wears. The composer, the page
// and the portfolio all read these, so a label lives once.

export const AVAILABILITIES: ArtAvailability[] = [
  'not_for_sale',
  'available',
  'sold',
  'commissioned',
  'on_show',
];

export const AVAILABILITY_MESSAGES = defineMessages({
  not_for_sale: {
    id: 'art.availability.not_for_sale',
    defaultMessage: 'Not for sale',
  },
  available: { id: 'art.availability.available', defaultMessage: 'Available' },
  sold: { id: 'art.availability.sold', defaultMessage: 'Sold' },
  commissioned: {
    id: 'art.availability.commissioned',
    defaultMessage: 'Commissioned',
  },
  on_show: { id: 'art.availability.on_show', defaultMessage: 'On show' },
});

const messages = defineMessages({
  size: {
    id: 'art.details.size',
    defaultMessage: '{dimensions} {unit}',
  },
  cm: { id: 'art.details.cm', defaultMessage: 'cm' },
  in: { id: 'art.details.in', defaultMessage: 'in' },
});

// "60 × 90 cm", "30 × 30 × 12 cm"; nothing when no dimension is set.
export const formatSize = (
  intl: IntlShape,
  piece: Pick<ArtPieceDetailsJSON, 'width' | 'height' | 'depth' | 'size_unit'>,
): string | null => {
  const parts = [piece.width, piece.height, piece.depth]
    .filter((n): n is number => typeof n === 'number' && n > 0)
    .map((n) => intl.formatNumber(n, { maximumFractionDigits: 2 }));
  if (parts.length === 0) return null;
  return intl.formatMessage(messages.size, {
    dimensions: parts.join(' × '),
    unit: intl.formatMessage(messages[piece.size_unit]),
  });
};

// The facts line, in the order people read a gallery label: what it's made
// of, how big, when, which edition. Empty parts are left out.
export const pieceFacts = (
  intl: IntlShape,
  piece: ArtPieceDetailsJSON,
): string[] =>
  [
    piece.medium?.trim(),
    formatSize(intl, piece),
    piece.year_made ? String(piece.year_made) : null,
    piece.edition?.trim(),
  ].filter((part): part is string => Boolean(part));

// A status worth showing on a card: anything but the default.
export const availabilityLabel = (
  intl: IntlShape,
  availability: ArtAvailability | undefined,
): string | null =>
  availability && availability !== 'not_for_sale'
    ? intl.formatMessage(AVAILABILITY_MESSAGES[availability])
    : null;
