import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import type { FtdSectionRow } from 'mastodon/api_types/freethedream';

import { Progress } from './shared';

// Working groups (or a section's sections) as tiles: who leads each, how
// many people have a hand in it, and how far along it is. The Overview
// shows them; Kontribute adds the tile for a new one.

const messages = defineMessages({
  done: { id: 'freethedream.done', defaultMessage: 'Done' },
  sectionsCount: {
    id: 'freethedream.sections_count',
    defaultMessage: '{count, plural, one {# section} other {# sections}}',
  },
  peopleIn: {
    id: 'freethedream.group.people',
    defaultMessage: '{count, plural, one {# person} other {# people}}',
  },
  leads: { id: 'freethedream.group.leads', defaultMessage: 'Led by {name}' },
});

export const GroupTiles: React.FC<{
  sections: FtdSectionRow[];
  addLabel?: string;
  onAdd?: () => void;
}> = ({ sections, addLabel, onAdd }) => {
  const intl = useIntl();

  return (
    <ul className='freethedream-groups'>
      {sections.map((section) => (
        <li key={section.id}>
          <Link
            to={`/hub/freethedream/p/${section.id}`}
            className='freethedream-group'
          >
            <span className='freethedream-group__title'>
              {section.title}
              {section.done && (
                <span className='freethedream-tag'>
                  {intl.formatMessage(messages.done)}
                </span>
              )}
            </span>
            <span className='freethedream-group__meta'>
              {[
                section.owner &&
                  intl.formatMessage(messages.leads, {
                    name: section.owner.display_name,
                  }),
                section.people_count > 0 &&
                  intl.formatMessage(messages.peopleIn, {
                    count: section.people_count,
                  }),
                section.sections_count > 0 &&
                  intl.formatMessage(messages.sectionsCount, {
                    count: section.sections_count,
                  }),
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
            {section.progress.total > 0 && (
              <Progress
                done={section.progress.sorted}
                of={section.progress.total}
              />
            )}
          </Link>
        </li>
      ))}
      {onAdd && addLabel && (
        <li>
          <button
            type='button'
            className='freethedream-group freethedream-group--add'
            onClick={onAdd}
          >
            {addLabel}
          </button>
        </li>
      )}
    </ul>
  );
};
