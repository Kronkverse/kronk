import { defineMessages } from 'react-intl';
import type { MessageDescriptor } from 'react-intl';

import type { ListingOffering } from 'mastodon/api_types/wachuneed';

// What a listing offers, picked first (Tal, 2026-11-09; docs/spaces/
// wachuneed.md, What are you offering?). A product is the plain listing;
// the others are a listing with booking, packages or lengths set up for
// that kind of offer, by their own composer (offering_composer.tsx).

export const OFFERINGS: readonly ListingOffering[] = [
  'product',
  'appointment',
  'service',
  'trip',
  'tickets',
];

export const isOffering = (value: unknown): value is ListingOffering =>
  typeof value === 'string' && (OFFERINGS as readonly string[]).includes(value);

export const offeringMessages = defineMessages({
  product: {
    id: 'wachuneed.offering.product',
    defaultMessage: 'Something to buy',
  },
  productHint: {
    id: 'wachuneed.offering.product_hint',
    defaultMessage: 'A thing you make or pass on',
  },
  appointment: {
    id: 'wachuneed.offering.appointment',
    defaultMessage: 'Appointment',
  },
  appointmentHint: {
    id: 'wachuneed.offering.appointment_hint',
    defaultMessage: 'People book a time with you: consultations, sessions',
  },
  service: { id: 'wachuneed.offering.service', defaultMessage: 'Service' },
  serviceHint: {
    id: 'wachuneed.offering.service_hint',
    defaultMessage: 'Packages or a quote: production, design, repairs',
  },
  trip: { id: 'wachuneed.offering.trip', defaultMessage: 'Trip or delivery' },
  tickets: { id: 'wachuneed.offering.tickets', defaultMessage: 'Tickets' },
  ticketsHint: {
    id: 'wachuneed.offering.tickets_hint',
    defaultMessage: 'Seats at a retreat, workshop or event',
  },
  tripHint: {
    id: 'wachuneed.offering.trip_hint',
    defaultMessage: 'From one place to another, at a time',
  },
  question: {
    id: 'wachuneed.offering.question',
    defaultMessage: 'What are you offering?',
  },
  change: {
    id: 'wachuneed.offering.change',
    defaultMessage: 'Change what you are offering',
  },
});

export const OFFERING_LABEL: Record<
  ListingOffering,
  { label: MessageDescriptor; hint: MessageDescriptor }
> = {
  product: {
    label: offeringMessages.product,
    hint: offeringMessages.productHint,
  },
  appointment: {
    label: offeringMessages.appointment,
    hint: offeringMessages.appointmentHint,
  },
  service: {
    label: offeringMessages.service,
    hint: offeringMessages.serviceHint,
  },
  trip: { label: offeringMessages.trip, hint: offeringMessages.tripHint },
  tickets: {
    label: offeringMessages.tickets,
    hint: offeringMessages.ticketsHint,
  },
};

// Line glyphs for each, in the space purple (--signal).
const GLYPHS: Record<ListingOffering, React.ReactNode> = {
  product: (
    <>
      <path d='M4 9h16l-1.5 10h-13z' />
      <path d='M9 9V6a3 3 0 0 1 6 0v3' />
    </>
  ),
  appointment: (
    <>
      <circle cx='12' cy='12' r='8' />
      <path d='M12 8v4l3 2' />
    </>
  ),
  service: (
    <>
      <path d='M9 18V6l10-2v12' />
      <circle cx='6.5' cy='18' r='2.5' />
      <circle cx='16.5' cy='16' r='2.5' />
    </>
  ),
  trip: (
    <>
      <circle cx='6' cy='18' r='2.5' />
      <circle cx='18' cy='6' r='2.5' />
      <path d='M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5' />
    </>
  ),
  tickets: (
    <>
      <path d='M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z' />
      <path d='M14 7v10' strokeDasharray='2 2' />
    </>
  ),
};

export const OfferingGlyph: React.FC<{
  offering: ListingOffering;
  size?: number;
}> = ({ offering, size = 24 }) => (
  <svg
    viewBox='0 0 24 24'
    width={size}
    height={size}
    fill='none'
    stroke='currentColor'
    strokeWidth='1.6'
    strokeLinecap='round'
    strokeLinejoin='round'
    aria-hidden='true'
  >
    {GLYPHS[offering]}
  </svg>
);
