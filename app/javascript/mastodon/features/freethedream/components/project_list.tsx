import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import { apiFtdProjects } from 'mastodon/api/freethedream';
import type { FtdProject } from 'mastodon/api_types/freethedream';
import { SpaceCard, SpaceGrid } from 'mastodon/components/space_grid';

import { ProjectComposer } from './project_composer';
import { Loading, useLoaded } from './shared';

const messages = defineMessages({
  emptyAll: {
    id: 'freethedream.empty.all',
    defaultMessage: 'No emergences yet. Seed one from the Ж menu.',
  },
  emptyMine: {
    id: 'freethedream.empty.mine',
    defaultMessage: "You haven't joined an emergence yet.",
  },
  joined: { id: 'freethedream.joined', defaultMessage: 'Joined' },
  asked: { id: 'freethedream.asked_short', defaultMessage: 'Asked' },
  done: { id: 'freethedream.done', defaultMessage: 'Done' },
  people: {
    id: 'freethedream.members_count',
    defaultMessage: '{count, plural, one {# person} other {# people}}',
  },
});

interface Props {
  scope: 'all' | 'mine';
  composer?: boolean;
}

// Every emergence, or the ones you're in. /hub/freethedream/composer opens
// "Seed an emergence" over the list (the Ж menu's compose route).
export const ProjectList: React.FC<Props> = ({ scope, composer }) => {
  const intl = useIntl();
  const history = useHistory();
  const { data: projects, failed } = useLoaded(scope, () =>
    apiFtdProjects(scope),
  );

  const closeComposer = useCallback(() => {
    history.replace('/hub/freethedream');
  }, [history]);

  const handleSaved = useCallback(
    (project: FtdProject) => {
      history.replace(`/hub/freethedream/p/${project.id}`);
    },
    [history],
  );

  return (
    <div className='freethedream-list'>
      {!projects ? (
        <Loading failed={failed} />
      ) : projects.length === 0 ? (
        <p className='freethedream__quiet'>
          {intl.formatMessage(
            scope === 'mine' ? messages.emptyMine : messages.emptyAll,
          )}
        </p>
      ) : (
        // The kit's grid tile (docs/design.md, Card standard): the cover
        // (or the linked event's image, as its page shows), the title, one
        // meta line, and whether you're in. A grid tile has no body, so
        // what it's about and its progress are on its page.
        <SpaceGrid>
          {projects.map((p) => (
            <SpaceCard
              key={p.id}
              to={`/hub/freethedream/p/${p.id}`}
              image={p.image_url}
              placeholder='🌱'
              title={p.title}
              meta={[
                intl.formatMessage(messages.people, {
                  count: p.members_count,
                }),
                p.ends_on &&
                  intl.formatDate(p.ends_on, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    timeZone: 'UTC',
                  }),
                p.done && intl.formatMessage(messages.done),
              ]
                .filter(Boolean)
                .join(' · ')}
              tag={
                p.membership === 'none'
                  ? undefined
                  : intl.formatMessage(
                      p.membership === 'member'
                        ? messages.joined
                        : messages.asked,
                    )
              }
            />
          ))}
        </SpaceGrid>
      )}

      {composer && (
        <ProjectComposer onCancel={closeComposer} onSaved={handleSaved} />
      )}
    </div>
  );
};
