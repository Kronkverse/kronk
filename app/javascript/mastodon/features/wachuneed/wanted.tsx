import { defineMessages, useIntl } from 'react-intl';
import type { IntlShape, MessageDescriptor } from 'react-intl';

import type {
  ApiListingJSON,
  ListingLookingFor,
  ListingWhereMode,
} from 'mastodon/api_types/wachuneed';

import type { KindChoice } from './offering_chooser';
import { KindChooser } from './offering_chooser';

// What a wanted ad is after, picked first (Tal, 2026-11-16; docs/spaces/
// wachuneed.md, Wanted ads): a thing someone has, something made for you,
// a job done, or someone for a time. A thing is the plain wanted ad; the
// others also ask where, by when, and how many people.

export const LOOKING_FOR: readonly ListingLookingFor[] = [
  'thing',
  'made',
  'job',
  'help',
];

export const isLookingFor = (value: unknown): value is ListingLookingFor =>
  typeof value === 'string' &&
  (LOOKING_FOR as readonly string[]).includes(value);

// How many people one wanted ad can take on (Listing::MAX_SPOTS).
export const MAX_SPOTS = 20;

export const WHERE_MODES: readonly ListingWhereMode[] = [
  'online',
  'in_person',
  'either',
];

export const isWhereMode = (value: unknown): value is ListingWhereMode =>
  typeof value === 'string' &&
  (WHERE_MODES as readonly string[]).includes(value);

export const wantedMessages = defineMessages({
  question: {
    id: 'wachuneed.wanted.question',
    defaultMessage: 'What are you looking for?',
  },
  change: {
    id: 'wachuneed.wanted.change',
    defaultMessage: 'Change what you are looking for',
  },
  thing: { id: 'wachuneed.wanted.thing', defaultMessage: 'Something to buy' },
  thingHint: {
    id: 'wachuneed.wanted.thing_hint',
    defaultMessage: 'A thing someone has: a bike, a table, a tent',
  },
  made: { id: 'wachuneed.wanted.made', defaultMessage: 'Something made' },
  madeHint: {
    id: 'wachuneed.wanted.made_hint',
    defaultMessage: 'Made for you: a video, a design, a painting',
  },
  job: { id: 'wachuneed.wanted.job', defaultMessage: 'A job done' },
  jobHint: {
    id: 'wachuneed.wanted.job_hint',
    defaultMessage: 'Work or a service: gardening, plans, repairs',
  },
  help: { id: 'wachuneed.wanted.help', defaultMessage: 'Someone for a time' },
  helpHint: {
    id: 'wachuneed.wanted.help_hint',
    defaultMessage: 'On a day: a photographer, a band, a hand moving house',
  },
  online: { id: 'wachuneed.wanted.where.online', defaultMessage: 'Online' },
  inPerson: {
    id: 'wachuneed.wanted.where.in_person',
    defaultMessage: 'In person',
  },
  either: {
    id: 'wachuneed.wanted.where.either',
    defaultMessage: 'Online or in person',
  },
  by: { id: 'wachuneed.wanted.by', defaultMessage: 'By {date}' },
  on: { id: 'wachuneed.wanted.on', defaultMessage: 'On {date}' },
  answers: {
    id: 'wachuneed.wanted.answers',
    defaultMessage: '{count, plural, one {# answer} other {# answers}}',
  },
  people: {
    id: 'wachuneed.wanted.people',
    defaultMessage: '{count, plural, one {# person} other {# people}}',
  },
});

export const LOOKING_FOR_LABEL: Record<
  ListingLookingFor,
  { label: MessageDescriptor; hint: MessageDescriptor }
> = {
  thing: { label: wantedMessages.thing, hint: wantedMessages.thingHint },
  made: { label: wantedMessages.made, hint: wantedMessages.madeHint },
  job: { label: wantedMessages.job, hint: wantedMessages.jobHint },
  help: { label: wantedMessages.help, hint: wantedMessages.helpHint },
};

export const WHERE_LABEL: Record<ListingWhereMode, MessageDescriptor> = {
  online: wantedMessages.online,
  in_person: wantedMessages.inPerson,
  either: wantedMessages.either,
};

// Line glyphs, drawn like the offering ones (offering.tsx).
const GLYPHS: Record<ListingLookingFor, React.ReactNode> = {
  thing: (
    <>
      <path d='M4 9h16l-1.5 10h-13z' />
      <path d='M9 9V6a3 3 0 0 1 6 0v3' />
    </>
  ),
  made: (
    <>
      <path d='M4 20l4-1 11-11-3-3L5 16z' />
      <path d='M14 7l3 3' />
    </>
  ),
  job: (
    <path d='M14.5 6.5a4 4 0 0 0-5 5L4 17l3 3 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-3-3z' />
  ),
  help: (
    <>
      <rect x='4' y='5' width='16' height='15' rx='2' />
      <path d='M4 10h16M9 3v4M15 3v4' />
    </>
  ),
};

export const WantedGlyph: React.FC<{
  lookingFor: ListingLookingFor;
  size?: number;
}> = ({ lookingFor, size = 24 }) => (
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
    {GLYPHS[lookingFor]}
  </svg>
);

export const WantedChooser: React.FC<{
  label: string;
  onPick: (lookingFor: ListingLookingFor) => void;
  onCancel: () => void;
}> = ({ label, onPick, onCancel }) => {
  const intl = useIntl();
  const choices: KindChoice<ListingLookingFor>[] = LOOKING_FOR.map(
    (lookingFor) => ({
      key: lookingFor,
      name: intl.formatMessage(LOOKING_FOR_LABEL[lookingFor].label),
      hint: intl.formatMessage(LOOKING_FOR_LABEL[lookingFor].hint),
      glyph: <WantedGlyph lookingFor={lookingFor} size={26} />,
    }),
  );

  return (
    <KindChooser
      label={label}
      question={intl.formatMessage(wantedMessages.question)}
      choices={choices}
      onPick={onPick}
      onCancel={onCancel}
    />
  );
};

// What a wanted ad's page says of it beyond the price: what it is after,
// where, by when (or on what day), and how many people, when more than one.
export const wantedFactsOf = (
  intl: IntlShape,
  listing: ApiListingJSON,
): string[] => {
  if (listing.kind !== 'wanted') return [];
  // Older wanted ads say nothing of what they are after: a thing.
  const lookingFor = listing.looking_for ?? 'thing';

  const facts = [intl.formatMessage(LOOKING_FOR_LABEL[lookingFor].label)];
  const answered = listing.answers_count
    ? [
        intl.formatMessage(wantedMessages.answers, {
          count: listing.answers_count,
        }),
      ]
    : [];
  if (lookingFor === 'thing') return [...facts, ...answered];

  if (listing.where_mode === 'online') {
    facts.push(intl.formatMessage(wantedMessages.online));
  } else if (listing.where_mode === 'either') {
    facts.push(intl.formatMessage(wantedMessages.either));
  }
  if (listing.due_on) {
    const date = intl.formatDate(new Date(`${listing.due_on}T00:00:00`), {
      day: 'numeric',
      month: 'short',
    });
    facts.push(
      intl.formatMessage(
        lookingFor === 'help' ? wantedMessages.on : wantedMessages.by,
        { date },
      ),
    );
  }
  if ((listing.spots ?? 1) > 1) {
    facts.push(
      intl.formatMessage(wantedMessages.people, { count: listing.spots }),
    );
  }
  return [...facts, ...answered];
};
