import { defineMessages, useIntl } from 'react-intl';
import type { MessageDescriptor } from 'react-intl';

import type {
  ListingLookingFor,
  ListingOffering,
} from 'mastodon/api_types/wachuneed';

import { OFFERINGS, OFFERING_LABEL, OfferingGlyph } from './offering';
import type { KindChoice } from './offering_chooser';
import { KindChoices, KindChooser } from './offering_chooser';
import { WantedGlyph } from './wanted';

// What + opens (Tal, 2026-11-17: + only offered things; "maybe we can work
// that in so there's only one type though, like, post a 'job'"): What are
// you offering?'s choices, then, under Looking for, the two kinds of wanted
// ad a new one can be. A job is someone to do work; Something is a thing
// to buy or borrow. Wanted ads that were made, or someone for a time, from
// before stay as they are.

export const POSTING_LOOKING_FOR: readonly ListingLookingFor[] = [
  'job',
  'thing',
];

const messages = defineMessages({
  question: {
    id: 'wachuneed.post.question',
    defaultMessage: 'What are you posting?',
  },
  lookingFor: {
    id: 'wachuneed.post.looking_for',
    defaultMessage: 'Looking for',
  },
  job: { id: 'wachuneed.post.job', defaultMessage: 'A job' },
  jobHint: {
    id: 'wachuneed.post.job_hint',
    defaultMessage: 'Someone to do work: a gardener, a design, repairs',
  },
  thing: { id: 'wachuneed.post.something', defaultMessage: 'Something' },
  thingHint: {
    id: 'wachuneed.post.something_hint',
    defaultMessage: 'To buy or borrow: a bike, a trailer, a tent',
  },
});

const LABELS: Partial<
  Record<
    ListingLookingFor,
    { label: MessageDescriptor; hint: MessageDescriptor }
  >
> = {
  job: { label: messages.job, hint: messages.jobHint },
  thing: { label: messages.thing, hint: messages.thingHint },
};

export const PostingChooser: React.FC<{
  onOffer: (offering: ListingOffering) => void;
  onLookFor: (lookingFor: ListingLookingFor) => void;
  onCancel: () => void;
}> = ({ onOffer, onLookFor, onCancel }) => {
  const intl = useIntl();
  const question = intl.formatMessage(messages.question);
  const offers: KindChoice<ListingOffering>[] = OFFERINGS.map((offering) => ({
    key: offering,
    name: intl.formatMessage(OFFERING_LABEL[offering].label),
    hint: intl.formatMessage(OFFERING_LABEL[offering].hint),
    glyph: <OfferingGlyph offering={offering} size={26} />,
  }));
  const wanted: KindChoice<ListingLookingFor>[] = POSTING_LOOKING_FOR.flatMap(
    (lookingFor) => {
      const label = LABELS[lookingFor];
      return label
        ? [
            {
              key: lookingFor,
              name: intl.formatMessage(label.label),
              hint: intl.formatMessage(label.hint),
              glyph: <WantedGlyph lookingFor={lookingFor} size={26} />,
            },
          ]
        : [];
    },
  );

  return (
    <KindChooser
      label={question}
      question={question}
      choices={offers}
      onPick={onOffer}
      onCancel={onCancel}
    >
      <section
        className='wachuneed-offering-group'
        aria-label={intl.formatMessage(messages.lookingFor)}
      >
        <h3 className='wachuneed-offering-group__heading'>
          {intl.formatMessage(messages.lookingFor)}
        </h3>
        <KindChoices choices={wanted} onPick={onLookFor} />
      </section>
    </KindChooser>
  );
};
