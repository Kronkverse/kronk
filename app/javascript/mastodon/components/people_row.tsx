import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

// Who's in a space, at a glance: their pictures in a row, overlapping,
// and past the first few a "+7" for the rest (Tal, 2026-11-10: "a rough
// idea of which people, and how many"). Each picture opens that person,
// unless the row is itself a button (`linked={false}`): a Krew's faces open
// its People. `total` is how many there are when `people` is only the first
// few. For any space with people (docs/design.md, Platform primitives).

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
  // How many people there are, if more than `people` holds.
  total?: number;
  // False inside something you tap as a whole: the pictures aren't links.
  linked?: boolean;
}> = ({ people, max = 5, total, linked = true }) => {
  const intl = useIntl();
  if (people.length === 0) return null;

  const count = Math.max(total ?? 0, people.length);
  // Never "+1": one more picture fits where the count would go.
  const shown =
    count === max + 1 ? people.slice(0, max + 1) : people.slice(0, max);
  const rest = count - shown.length;

  return (
    <div
      className='people-row'
      role='group'
      aria-label={intl.formatMessage(messages.label, { count })}
    >
      {shown.map((person) =>
        linked ? (
          <Link
            key={person.id}
            to={`/@${person.acct}`}
            className='people-row__person'
            title={person.display_name || person.acct}
          >
            <img src={person.avatar} alt={person.display_name || person.acct} />
          </Link>
        ) : (
          <span key={person.id} className='people-row__person'>
            <img src={person.avatar} alt='' />
          </span>
        ),
      )}
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
