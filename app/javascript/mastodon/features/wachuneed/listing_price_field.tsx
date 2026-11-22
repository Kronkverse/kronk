import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type {
  ListingPriceType,
  ListingPriceUnit,
} from 'mastodon/api_types/wachuneed';
import {
  ComposeField,
  ComposeInput,
  ComposeRow,
  ComposeSelect,
} from 'mastodon/components/compose_fields';

// The price in a listing composer (docs/spaces/wachuneed.md, Prices): what
// kind of price it is, then the amount and what it is for when it has one
// ("A$38 an hour"). A wanted ad says what the poster pays, or up to what;
// something on offer has no "up to".

const messages = defineMessages({
  price: { id: 'wachuneed.price_field.price', defaultMessage: 'Price' },
  pay: { id: 'wachuneed.price_field.pay', defaultMessage: "What you'll pay" },
  amount: {
    id: 'wachuneed.price_field.amount',
    defaultMessage: 'Amount (in AUD)',
  },
  per: { id: 'wachuneed.price_field.per', defaultMessage: 'For' },
  fixed: { id: 'wachuneed.price_field.fixed', defaultMessage: 'A set price' },
  paying: {
    id: 'wachuneed.price_field.paying',
    defaultMessage: 'A set amount',
  },
  upTo: { id: 'wachuneed.price_field.up_to', defaultMessage: 'Up to' },
  offers: {
    id: 'wachuneed.price_field.offers',
    defaultMessage: 'Open to offers',
  },
  quote: {
    id: 'wachuneed.price_field.quote',
    defaultMessage: 'Quote on request',
  },
  quotes: {
    id: 'wachuneed.price_field.quotes',
    defaultMessage: 'Ask for quotes',
  },
  trade: { id: 'wachuneed.price_field.trade', defaultMessage: 'Trade or swap' },
  free: { id: 'wachuneed.price_field.free', defaultMessage: 'Free' },
  payWhatYouWant: {
    id: 'wachuneed.price_field.pay_what_you_want',
    defaultMessage: 'Pay what you want',
  },
  donation: {
    id: 'wachuneed.price_field.donation',
    defaultMessage: 'Free, for a donation',
  },
  whole: { id: 'wachuneed.price_field.whole', defaultMessage: 'The lot' },
  hour: { id: 'wachuneed.price_field.hour', defaultMessage: 'An hour' },
  day: { id: 'wachuneed.price_field.day', defaultMessage: 'A day' },
  week: { id: 'wachuneed.price_field.week', defaultMessage: 'A week' },
  month: { id: 'wachuneed.price_field.month', defaultMessage: 'A month' },
  session: { id: 'wachuneed.price_field.session', defaultMessage: 'A session' },
});

const OFFER_TYPES: ListingPriceType[] = [
  'fixed',
  'offers',
  'quote',
  'trade',
  'free',
];
const WANTED_TYPES: ListingPriceType[] = [
  'fixed',
  'up_to',
  'offers',
  'quote',
  'trade',
  'free',
];
// A lesson (Lessons): a set price or Pay what you want unlock it person
// by person; Free and a donation open it to everyone who can see it.
const LESSON_TYPES: ListingPriceType[] = [
  'fixed',
  'offers',
  'donation',
  'free',
];
const UNITS: ListingPriceUnit[] = ['hour', 'day', 'week', 'month', 'session'];

export const priceHasAmount = (type: ListingPriceType) =>
  type === 'fixed' || type === 'up_to';

export const isPriceType = (value: unknown): value is ListingPriceType =>
  typeof value === 'string' &&
  ([...WANTED_TYPES, 'donation'] as readonly string[]).includes(value);

export const isPriceUnit = (value: unknown): value is ListingPriceUnit =>
  typeof value === 'string' && (UNITS as readonly string[]).includes(value);

interface Props {
  wanted: boolean;
  // A lesson's own kinds of price, each for the whole lesson.
  lesson?: boolean;
  type: ListingPriceType;
  amount: string;
  unit: ListingPriceUnit | null;
  onType: (type: ListingPriceType) => void;
  onAmount: (amount: string) => void;
  onUnit: (unit: ListingPriceUnit | null) => void;
}

export const ListingPriceField: React.FC<Props> = ({
  wanted,
  lesson = false,
  type,
  amount,
  unit,
  onType,
  onAmount,
  onUnit,
}) => {
  const intl = useIntl();

  const typeLabel = (value: ListingPriceType) => {
    switch (value) {
      case 'fixed':
        return intl.formatMessage(wanted ? messages.paying : messages.fixed);
      case 'up_to':
        return intl.formatMessage(messages.upTo);
      case 'offers':
        return intl.formatMessage(
          lesson ? messages.payWhatYouWant : messages.offers,
        );
      case 'donation':
        return intl.formatMessage(messages.donation);
      case 'quote':
        return intl.formatMessage(wanted ? messages.quotes : messages.quote);
      case 'trade':
        return intl.formatMessage(messages.trade);
      case 'free':
        return intl.formatMessage(messages.free);
    }
  };

  const handleType = useCallback<React.ChangeEventHandler<HTMLSelectElement>>(
    (e) => {
      const value = e.currentTarget.value;
      if (isPriceType(value)) onType(value);
    },
    [onType],
  );
  const handleAmount = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      onAmount(e.currentTarget.value);
    },
    [onAmount],
  );
  const handleUnit = useCallback<React.ChangeEventHandler<HTMLSelectElement>>(
    (e) => {
      const value = e.currentTarget.value;
      onUnit(isPriceUnit(value) ? value : null);
    },
    [onUnit],
  );

  return (
    <>
      <ComposeField
        label={intl.formatMessage(wanted ? messages.pay : messages.price)}
      >
        <ComposeSelect value={type} onChange={handleType}>
          {(lesson ? LESSON_TYPES : wanted ? WANTED_TYPES : OFFER_TYPES).map(
            (value) => (
              <option key={value} value={value}>
                {typeLabel(value)}
              </option>
            ),
          )}
        </ComposeSelect>
      </ComposeField>

      {priceHasAmount(type) && lesson && (
        <ComposeField label={intl.formatMessage(messages.amount)}>
          <ComposeInput
            type='number'
            min={0}
            step={0.01}
            value={amount}
            onChange={handleAmount}
          />
        </ComposeField>
      )}

      {priceHasAmount(type) && !lesson && (
        <ComposeRow>
          <ComposeField label={intl.formatMessage(messages.amount)}>
            <ComposeInput
              type='number'
              min={0}
              step={0.01}
              value={amount}
              onChange={handleAmount}
            />
          </ComposeField>
          <ComposeField label={intl.formatMessage(messages.per)}>
            <ComposeSelect value={unit ?? ''} onChange={handleUnit}>
              <option value=''>{intl.formatMessage(messages.whole)}</option>
              {UNITS.map((value) => (
                <option key={value} value={value}>
                  {intl.formatMessage(messages[value])}
                </option>
              ))}
            </ComposeSelect>
          </ComposeField>
        </ComposeRow>
      )}
    </>
  );
};
