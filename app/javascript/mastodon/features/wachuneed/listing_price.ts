import { defineMessages, useIntl } from 'react-intl';
import type { IntlShape } from 'react-intl';

import type {
  ListingPriceType,
  ListingPriceUnit,
} from 'mastodon/api_types/wachuneed';

// How a listing's price reads wherever it shows (docs/spaces/wachuneed.md,
// Prices): the tile, the listing page, the feed card. The server formats
// the amount (`price_display`, "A$38.00"); this says what kind of price it
// is and what the amount is for: "A$38.00 / hour", "Up to A$500.00",
// "Quote". Null when there is nothing to say (no amount, a set price).

const messages = defineMessages({
  perHour: {
    id: 'wachuneed.price.per_hour',
    defaultMessage: '{amount} / hour',
  },
  perDay: { id: 'wachuneed.price.per_day', defaultMessage: '{amount} / day' },
  perWeek: {
    id: 'wachuneed.price.per_week',
    defaultMessage: '{amount} / week',
  },
  perMonth: {
    id: 'wachuneed.price.per_month',
    defaultMessage: '{amount} / month',
  },
  perSession: {
    id: 'wachuneed.price.per_session',
    defaultMessage: '{amount} / session',
  },
  upTo: { id: 'wachuneed.price.up_to', defaultMessage: 'Up to {amount}' },
  offers: { id: 'wachuneed.price.offers', defaultMessage: 'Open to offers' },
  quote: { id: 'wachuneed.price.quote', defaultMessage: 'Quote' },
  trade: { id: 'wachuneed.price.trade', defaultMessage: 'Trade' },
  free: { id: 'wachuneed.price.free', defaultMessage: 'Free' },
});

const PER = {
  hour: messages.perHour,
  day: messages.perDay,
  week: messages.perWeek,
  month: messages.perMonth,
  session: messages.perSession,
} as const;

interface Priced {
  price_display?: string | null;
  price_type?: ListingPriceType | null;
  price_unit?: ListingPriceUnit | null;
}

export const formatListingPrice = (
  intl: IntlShape,
  listing: Priced,
): string | null => {
  const type = listing.price_type ?? 'fixed';

  if (type === 'offers') return intl.formatMessage(messages.offers);
  if (type === 'quote') return intl.formatMessage(messages.quote);
  if (type === 'trade') return intl.formatMessage(messages.trade);
  if (type === 'free') return intl.formatMessage(messages.free);

  const shown = listing.price_display;
  if (!shown) return null;

  const amount = listing.price_unit
    ? intl.formatMessage(PER[listing.price_unit], { amount: shown })
    : shown;

  return type === 'up_to'
    ? intl.formatMessage(messages.upTo, { amount })
    : amount;
};

export const useListingPrice = (listing: Priced): string | null =>
  formatListingPrice(useIntl(), listing);
