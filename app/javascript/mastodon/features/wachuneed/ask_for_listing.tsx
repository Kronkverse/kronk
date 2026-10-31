import { useCallback, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import { isAxiosError } from 'axios';

import { apiAskForListing } from 'mastodon/api/wachuneed_requests';
import type {
  ApiListingJSON,
  ApiListingVariantsJSON,
} from 'mastodon/api_types/wachuneed';
import { KornerPill } from 'mastodon/components/korner_pill';

import {
  BookingFields,
  EMPTY_BOOKING_VALUE,
  bookingComplete,
} from './booking_fields';
import type { BookingValue } from './booking_fields';
import { selectedVariant } from './listing_variant_chooser';
import type { ChosenVariant } from './listing_variant_chooser';

// Ask for this (docs/spaces/wachuneed.md, Requests): sends the seller a
// request with the kind, extras and quantity picked above it on the listing
// page. The seller accepts or declines from Requests; Kronk takes no
// payment, so what happens next is between the two of them.
//
// A listing built from booking parts (docs/spaces/wachuneed.md, Booking)
// asks for them first (booking_fields.tsx) and is booked, not asked for.

const messages = defineMessages({
  ask: { id: 'wachuneed.requests.ask', defaultMessage: 'Ask for this' },
  book: { id: 'wachuneed.requests.book', defaultMessage: 'Book' },
  booked: {
    id: 'wachuneed.requests.booked',
    defaultMessage: 'Booked. You will hear when they say yes.',
  },
  pickKind: {
    id: 'wachuneed.requests.pick_kind',
    defaultMessage: 'Choose one of each above to ask for it.',
  },
  asked: {
    id: 'wachuneed.requests.asked',
    defaultMessage: 'Asked. You will hear when they answer.',
  },
  seeRequests: {
    id: 'wachuneed.requests.see',
    defaultMessage: 'Your requests',
  },
  failed: {
    id: 'wachuneed.requests.failed',
    defaultMessage: 'That did not go through. Try again?',
  },
});

export const AskForListing: React.FC<{
  listing: ApiListingJSON;
  variants: ApiListingVariantsJSON | null;
  variantChosen: ChosenVariant;
  // The choice picked in each option, by the option's index.
  chosen: Record<number, number>;
  quantity: number;
}> = ({ listing, variants, variantChosen, chosen, quantity }) => {
  const intl = useIntl();
  const [state, setState] = useState<'idle' | 'busy' | 'asked'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingValue>(EMPTY_BOOKING_VALUE);
  const parts = useMemo(() => listing.booking?.parts ?? [], [listing.booking]);
  const booked = parts.length > 0;
  const bookingReady =
    !booked || !listing.booking || bookingComplete(listing.booking, booking);

  const variant = selectedVariant(variants, variantChosen);
  const needsKind = !!variants && !variant;
  const soldOut =
    variant?.availability === 'sold_out' || listing.availability === 'sold_out';

  const handleAsk = useCallback(() => {
    setState('busy');
    setError(null);
    apiAskForListing(listing.id, {
      variant: variants?.axes.map((_, index) => variantChosen[index] ?? ''),
      options: (listing.options ?? []).flatMap((option, index) => {
        const choice = option.choices[chosen[index] ?? -1];
        return choice ? [{ name: option.name, choice: choice.label }] : [];
      }),
      quantity,
      ...(booked
        ? {
            starts_at: booking.startsAt ?? undefined,
            route: parts.includes('route') ? booking.route : undefined,
            details: booking.details.trim() || undefined,
          }
        : {}),
    })
      .then(() => {
        setState('asked');
        return undefined;
      })
      .catch((e: unknown) => {
        const said: unknown = isAxiosError(e)
          ? (e.response?.data as { error?: unknown } | undefined)?.error
          : null;
        setError(
          typeof said === 'string' ? said : intl.formatMessage(messages.failed),
        );
        setState('idle');
      });
  }, [
    booked,
    booking,
    chosen,
    intl,
    listing,
    parts,
    quantity,
    variantChosen,
    variants,
  ]);

  if (state === 'asked') {
    return (
      <p className='wachuneed-detail__asked' role='status'>
        {intl.formatMessage(booked ? messages.booked : messages.asked)}{' '}
        <Link to='/hub/wachuneed/requests'>
          {intl.formatMessage(messages.seeRequests)}
        </Link>
      </p>
    );
  }

  return (
    <div className='wachuneed-detail__ask'>
      {booked && listing.booking && (
        <BookingFields
          listingId={listing.id}
          booking={listing.booking}
          value={booking}
          onChange={setBooking}
        />
      )}
      <KornerPill
        label={intl.formatMessage(booked ? messages.book : messages.ask)}
        variant='primary'
        onClick={handleAsk}
        disabled={state === 'busy' || needsKind || soldOut || !bookingReady}
      />
      {needsKind && (
        <p className='wachuneed__compose-hint'>
          {intl.formatMessage(messages.pickKind)}
        </p>
      )}
      {error && (
        <p className='wachuneed__compose-hint' role='alert'>
          {error}
        </p>
      )}
    </div>
  );
};
