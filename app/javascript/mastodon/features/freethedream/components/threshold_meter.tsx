import { defineMessages, useIntl } from 'react-intl';

import type { FtdThreshold } from 'mastodon/api_types/freethedream';

import { Section } from './shared';

// A projekt's threshold meter (Tomas's proposal "Threshold Meter",
// docs/spaces/freethedream.md, The threshold): what it needs before it
// begins, people in it and things sorted, and how close it is. One bar per
// measure rather than one combined, because both have to be reached and a
// single bar would hide which one is short. A small target is drawn as
// segments, one per person or thing, so the meter reads as a count; a big
// one is a smooth bar. Once begun, it says so and when.

const SEGMENTS_MAX = 20;

const messages = defineMessages({
  title: {
    id: 'freethedream.threshold.title',
    defaultMessage: 'Begins when',
  },
  bothHint: {
    id: 'freethedream.threshold.both_hint',
    defaultMessage: 'It begins once both are reached.',
  },
  oneHint: {
    id: 'freethedream.threshold.one_hint',
    defaultMessage: 'It begins once this is reached.',
  },
  people: { id: 'freethedream.threshold.people', defaultMessage: 'People' },
  things: {
    id: 'freethedream.threshold.things',
    defaultMessage: 'Things sorted',
  },
  count: {
    id: 'freethedream.threshold.count',
    defaultMessage: '{count} of {of}',
  },
  peopleText: {
    id: 'freethedream.threshold.people_text',
    defaultMessage: '{count} of {of} people',
  },
  thingsText: {
    id: 'freethedream.threshold.things_text',
    defaultMessage: '{count} of {of} things sorted',
  },
  begun: {
    id: 'freethedream.threshold.begun',
    defaultMessage: 'Begun {date}',
  },
  begunHint: {
    id: 'freethedream.threshold.begun_hint',
    defaultMessage: 'It reached its threshold.',
  },
});

const Measure: React.FC<{
  label: string;
  text: string;
  count: number;
  of: number;
}> = ({ label, text, count, of }) => {
  const intl = useIntl();
  const shown = Math.min(count, of);
  const met = count >= of;

  return (
    <div
      className={
        met
          ? 'freethedream-threshold__measure freethedream-threshold__measure--met'
          : 'freethedream-threshold__measure'
      }
    >
      <div className='freethedream-threshold__label'>
        <span>{label}</span>
        <span className='freethedream-threshold__count'>
          {intl.formatMessage(messages.count, { count: shown, of })}
        </span>
      </div>
      <div
        className={
          of <= SEGMENTS_MAX
            ? 'freethedream-threshold__track'
            : 'freethedream-threshold__track freethedream-threshold__track--smooth'
        }
        role='meter'
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={of}
        aria-valuenow={shown}
        aria-valuetext={text}
      >
        {of <= SEGMENTS_MAX ? (
          Array.from({ length: of }, (_, i) => (
            <span
              key={i}
              className={
                i < shown
                  ? 'freethedream-threshold__segment freethedream-threshold__segment--on'
                  : 'freethedream-threshold__segment'
              }
            />
          ))
        ) : (
          <span
            className='freethedream-threshold__fill'
            style={{ inlineSize: `${(shown / of) * 100}%` }}
          />
        )}
      </div>
    </div>
  );
};

export const ThresholdMeter: React.FC<{ threshold: FtdThreshold }> = ({
  threshold,
}) => {
  const intl = useIntl();
  const { people, things, people_count, things_sorted, begun_at } = threshold;

  if (begun_at) {
    return (
      <Section title={intl.formatMessage(messages.title)}>
        <div className='freethedream-threshold freethedream-threshold--begun'>
          <p className='freethedream-threshold__begun'>
            {intl.formatMessage(messages.begun, {
              date: intl.formatDate(begun_at, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }),
            })}
          </p>
          <p className='freethedream__quiet'>
            {intl.formatMessage(messages.begunHint)}
          </p>
        </div>
      </Section>
    );
  }

  return (
    <Section title={intl.formatMessage(messages.title)}>
      <div className='freethedream-threshold'>
        {people !== null && (
          <Measure
            label={intl.formatMessage(messages.people)}
            text={intl.formatMessage(messages.peopleText, {
              count: Math.min(people_count, people),
              of: people,
            })}
            count={people_count}
            of={people}
          />
        )}
        {things !== null && (
          <Measure
            label={intl.formatMessage(messages.things)}
            text={intl.formatMessage(messages.thingsText, {
              count: Math.min(things_sorted, things),
              of: things,
            })}
            count={things_sorted}
            of={things}
          />
        )}
        <p className='freethedream__quiet'>
          {intl.formatMessage(
            people !== null && things !== null
              ? messages.bothHint
              : messages.oneHint,
          )}
        </p>
      </div>
    </Section>
  );
};
