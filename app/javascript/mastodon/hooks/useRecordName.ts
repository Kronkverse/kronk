import { useMemo } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useAppSelector } from 'mastodon/store';

// useRecordName — a record named as what it is, wherever Kronk refers to
// one: "the Ember event", "the Ember Krew" (decisions.md, 2026-10-26). An
// event, its Krew, its album and its emergence often share a title; the
// title alone can't tell them apart.
//
// The word is the record's own `noun` when the server sent one (a
// FreeTheDream gang says gang), else its korner's `konnect.noun` from the
// manifest. `korners doctor` holds every korner that takes links to having
// one.
//
//   const names = useRecordName();
//   names.noun('kalendar')                       // 'event'
//   names.the({ slug: 'kalendar', title: 'Ember' })  // 'the Ember event'
//   names.The({ slug: 'krew', title: 'Ember' })      // 'The Ember Krew'

const messages = defineMessages({
  the: { id: 'record_name.the', defaultMessage: 'the {title} {noun}' },
  theStart: {
    id: 'record_name.the_start',
    defaultMessage: 'The {title} {noun}',
  },
  untitled: { id: 'record_name.untitled', defaultMessage: 'this {noun}' },
  untitledStart: {
    id: 'record_name.untitled_start',
    defaultMessage: 'This {noun}',
  },
});

export interface NamedRecord {
  slug: string;
  title?: string | null;
  noun?: string | null;
}

export interface RecordNames {
  // What one of the korner's records is called, or null when it says.
  noun: (slug: string, own?: string | null) => string | null;
  // "the Ember event", mid-sentence.
  the: (record: NamedRecord) => string;
  // "The Ember event", to start one.
  The: (record: NamedRecord) => string;
}

export const useRecordName = (): RecordNames => {
  const intl = useIntl();
  const korners = useAppSelector((state) => state.korners);

  return useMemo(() => {
    const noun = (slug: string, own?: string | null) =>
      own ?? korners[slug]?.konnect?.noun ?? null;
    const name = (record: NamedRecord, start: boolean) => {
      const word = noun(record.slug, record.noun);
      const title = record.title?.trim();
      if (!word) return title ?? record.slug;
      if (!title)
        return intl.formatMessage(
          start ? messages.untitledStart : messages.untitled,
          { noun: word },
        );
      return intl.formatMessage(start ? messages.theStart : messages.the, {
        title,
        noun: word,
      });
    };
    return {
      noun,
      the: (record) => name(record, false),
      The: (record) => name(record, true),
    };
  }, [intl, korners]);
};
