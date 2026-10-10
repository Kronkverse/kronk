import { defineMessages } from 'react-intl';
import type { MessageDescriptor } from 'react-intl';

// What each notification says. Keyed by `<source korner>.<verb>`, the same
// pair Nudges::EventRouter writes. Every sentence takes `{who}` (the actor,
// or "Ana and 2 others" for a rolled-up row) and reads as a plain sentence
// about the viewer's own thing.
//
// Declared statically, one descriptor per sentence, so the extractor sees
// them all — never build an id from the verb at runtime. A pair with no
// entry falls back to `generic`, which names the korner.
const sentences = defineMessages({
  feedFrothed: {
    id: 'nudges.notification.feed.frothed',
    defaultMessage: '{who} frothed your post',
  },
  feedReplied: {
    id: 'nudges.notification.feed.replied',
    defaultMessage: '{who} replied to your post',
  },
  feedMentioned: {
    id: 'nudges.notification.feed.mentioned',
    defaultMessage: '{who} mentioned you',
  },
  kommonsBacked: {
    id: 'nudges.notification.kommons.backed',
    defaultMessage: '{who} backed your proposal',
  },
  kommonsClaimed: {
    id: 'nudges.notification.kommons.claimed',
    defaultMessage: '{who} picked up your proposal',
  },
  kommonsFrothed: {
    id: 'nudges.notification.kommons.frothed',
    defaultMessage: '{who} frothed your proposal',
  },
  kommonsCommented: {
    id: 'nudges.notification.kommons.commented',
    defaultMessage: '{who} commented on your proposal',
  },
  kalendarGoing: {
    id: 'nudges.notification.kalendar.going',
    defaultMessage: '{who} is going to your event',
  },
  kalendarInterested: {
    id: 'nudges.notification.kalendar.interested',
    defaultMessage: '{who} is interested in your event',
  },
  kalendarNotGoing: {
    id: 'nudges.notification.kalendar.not_going',
    defaultMessage: "{who} can't make your event",
  },
  wachuneedOffered: {
    id: 'nudges.notification.wachuneed.offered',
    defaultMessage: '{who} made an offer on your listing',
  },
  wachuneedOfferAccepted: {
    id: 'nudges.notification.wachuneed.offer_accepted',
    defaultMessage: '{who} accepted your offer',
  },
  wachuneedOfferDeclined: {
    id: 'nudges.notification.wachuneed.offer_declined',
    defaultMessage: '{who} declined your offer',
  },
  kuestionsAnswered: {
    id: 'nudges.notification.kuestions.answered',
    defaultMessage: '{who} answered your question',
  },
  kuestionsFrothed: {
    id: 'nudges.notification.kuestions.frothed',
    defaultMessage: '{who} frothed your question',
  },
  boothFrothed: {
    id: 'nudges.notification.booth.frothed',
    defaultMessage: '{who} frothed your set',
  },
  albuttsAddedPhoto: {
    id: 'nudges.notification.albutts.added_photo',
    defaultMessage: '{who} added to an album you share',
  },
  matesRequested: {
    id: 'nudges.notification.mates.requested',
    defaultMessage: '{who} wants to be Mates',
  },
  matesAccepted: {
    id: 'nudges.notification.mates.accepted',
    defaultMessage: '{who} is now your Mate',
  },
  generic: {
    id: 'nudges.notification.generic',
    defaultMessage: '{who} has something for you in {korner}',
  },
});

const SENTENCES: Record<string, MessageDescriptor | undefined> = {
  'feed.frothed': sentences.feedFrothed,
  'feed.replied': sentences.feedReplied,
  'feed.mentioned': sentences.feedMentioned,
  // Mentions routed straight from FanOutOnWriteService carry these.
  'nudges.mention': sentences.feedMentioned,
  'kommons.backed': sentences.kommonsBacked,
  'kommons.claimed': sentences.kommonsClaimed,
  'kommons.frothed': sentences.kommonsFrothed,
  'kommons.commented': sentences.kommonsCommented,
  'kalendar.rsvpd_going': sentences.kalendarGoing,
  'kalendar.rsvpd_interested': sentences.kalendarInterested,
  'kalendar.rsvpd_not_going': sentences.kalendarNotGoing,
  'wachuneed.offered': sentences.wachuneedOffered,
  'wachuneed.offer_accepted': sentences.wachuneedOfferAccepted,
  'wachuneed.offer_declined': sentences.wachuneedOfferDeclined,
  'kuestions.answered': sentences.kuestionsAnswered,
  'kuestions.frothed': sentences.kuestionsFrothed,
  'booth.frothed': sentences.boothFrothed,
  'albutts.added_photo': sentences.albuttsAddedPhoto,
  'mates.mate_requested': sentences.matesRequested,
  'mates.mate_accepted': sentences.matesAccepted,
};

export const genericSentence = sentences.generic;

// The sentence for a notification, or undefined when the pair is one this
// file does not know (the caller then uses `genericSentence`).
export const sentenceFor = (
  kornerSlug: string,
  verb: string,
): MessageDescriptor | undefined => SENTENCES[`${kornerSlug}.${verb}`];

export const whoMessages = defineMessages({
  // "Ana and 2 others" — `count` is how many people beyond the one named.
  andOthers: {
    id: 'nudges.notification.who_and_others',
    defaultMessage:
      '{name} and {count, plural, one {# other} other {# others}}',
  },
});
