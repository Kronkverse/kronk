import { defineMessages } from 'react-intl';
import type { IntlShape } from 'react-intl';

import type {
  ArtAvailability,
  ArtKind,
  ArtPieceDetailsJSON,
} from 'mastodon/api_types/art';

import { artKindLabel } from './kinds';

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

// "60 × 90 cm" (width × height); nothing when neither is set.
export const formatSize = (
  intl: IntlShape,
  piece: Pick<ArtPieceDetailsJSON, 'width' | 'height' | 'depth' | 'size_unit'>,
): string | null => {
  const parts = [piece.width, piece.height]
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

// The line under a piece on every card — the Art grid, a portfolio, a
// profile's Art shelf: its first medium (or its materials, or its kind),
// and the year it was made.
export const pieceCardLine = (
  intl: IntlShape,
  piece: {
    kind: ArtKind;
    mediums?: string[];
    medium?: string | null;
    year_made?: number | null;
  },
): string =>
  [
    piece.mediums?.[0] ??
      (piece.medium?.trim()
        ? piece.medium.trim()
        : artKindLabel(intl, piece.kind)),
    piece.year_made ? String(piece.year_made) : null,
  ]
    .filter(Boolean)
    .join(' · ');

// Prices are AUD for now, as in Wachuneed; the currency is kept with each.
export const PRICE_CURRENCY = 'AUD';

// "$1,200 AUD", or "$1,200.50 AUD" when there are cents.
export const formatPrice = (
  intl: IntlShape,
  cents: number,
  currency: string = PRICE_CURRENCY,
): string =>
  `${intl.formatNumber(cents / 100, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })} ${currency}`;

// What's typed in a price box ("1,200", "$1200.50") as whole cents, or null
// when it's blank or not a price.
export const parsePrice = (typed: string): number | null => {
  const n = Number.parseFloat(typed.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
};

// A price box's starting text for a saved price: "1200", "1200.50".
export const priceText = (cents: number | null | undefined): string =>
  cents
    ? cents % 100 === 0
      ? String(cents / 100)
      : (cents / 100).toFixed(2)
    : '';

// The price of a piece that's for sale, when the artist gave one.
export const piecePrice = (
  intl: IntlShape,
  piece: {
    availability?: ArtAvailability;
    price_cents?: number | null;
    price_currency?: string;
  },
): string | null =>
  piece.availability === 'available' && piece.price_cents
    ? formatPrice(intl, piece.price_cents, piece.price_currency)
    : null;
