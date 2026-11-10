import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

// Who's in a space, at a glance: their pictures in a row, overlapping,
// and past the first few a "+7" for the rest (Tal, 2026-11-10: "a rough
// idea of which people, and how many"). Each picture opens that person.
// For any space with people: a Komponent now, Krews and events next
// (docs/design.md, Platform primitives).

const messages = defineMessages({
  more: {
    id: 'people_row.more',
    defaultMessage:
      '{count, plural, one {# more person} other {# more people}}',
  },
  label: {
    id: 'people_row.label',
    defaultMessage: '{count, plural, one {# person} other {# people}}',
  },
});

export interface PeopleRowPerson {
  id: string;
  acct: string;
  display_name: string;
  avatar: string;
}

export const PeopleRow: React.FC<{
  people: PeopleRowPerson[];
  // How many pictures before the "+N".
  max?: number;
}> = ({ people, max = 5 }) => {
  const intl = useIntl();
  if (people.length === 0) return null;

  // Never "+1": one more picture fits where the count would go.
  const shown = people.length === max + 1 ? people : people.slice(0, max);
  const rest = people.length - shown.length;

  return (
    <div
      className='people-row'
      role='group'
      aria-label={intl.formatMessage(messages.label, { count: people.length })}
    >
      {shown.map((person) => (
        <Link
          key={person.id}
          to={`/@${person.acct}`}
          className='people-row__person'
          title={person.display_name || person.acct}
        >
          <img src={person.avatar} alt={person.display_name || person.acct} />
        </Link>
      ))}
      {rest > 0 && (
        <span
          className='people-row__more'
          title={intl.formatMessage(messages.more, { count: rest })}
        >
          +{rest}
        </span>
      )}
    </div>
  );
};
