import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import type { FtdSectionRow } from 'mastodon/api_types/freethedream';

import { Progress, projectPath } from './shared';

// Gangs (or a gang's fractals) as cards, in one row that scrolls sideways
// with the next card peeking in (`row`, Tal 2026-11-08: "Komponents should
// be in swipable cards rather than grid view"): how many people have a hand in
// each, how many fractals it has, how far along it is, and a count of talk
// you haven't seen in your own. Nobody leads a
// gang (Tal, 2026-10-15), so no owner shows. Members get the tile to
// coalesce a new one.
//
// They are what a projekt is made of, so they have a card of their own,
// larger than a space's (Tal, 2026-11-09: "Komponents are the important part
// of a projekt, and currently they look the same as kuestions"): its
// name large, who's in it, and how far along it is as a bar along the foot.

const messages = defineMessages({
  done: { id: 'freethedream.done', defaultMessage: 'Done' },
  unseen: { id: 'freethedream.dash.new_count', defaultMessage: '{count} new' },
  joined: { id: 'freethedream.gang.joined', defaultMessage: 'Joined' },
});

export const GroupTiles: React.FC<{
  sections: (FtdSectionRow & { unseen?: number })[];
  addLabel?: string;
  onAdd?: () => void;
  row?: boolean;
}> = ({ sections, addLabel, onAdd, row = false }) => {
  const intl = useIntl();

  return (
    <ul
      className={
        row
          ? 'freethedream-groups freethedream-groups--row'
          : 'freethedream-groups'
      }
    >
      {sections.map((section) => (
        <li key={section.id}>
          <Link to={projectPath(section)} className='freethedream-group'>
            <span className='freethedream-group__tags'>
              {!!section.unseen && (
                <span className='freethedream-tag'>
                  {intl.formatMessage(messages.unseen, {
                    count: section.unseen,
                  })}
                </span>
              )}
              {section.joined && (
                <span className='freethedream-tag'>
                  {intl.formatMessage(messages.joined)}
                </span>
              )}
              {section.done && (
                <span className='freethedream-tag'>
                  {intl.formatMessage(messages.done)}
                </span>
              )}
            </span>
            <span className='freethedream-group__title'>{section.title}</span>
            {/* What it is, not how many: its description, in brief (Tal,
                2026-11-10). */}
            {section.description && (
              <span className='freethedream-group__about'>
                {section.description}
              </span>
            )}
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
