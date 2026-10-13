import { useCallback } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Link, useHistory } from 'react-router-dom';

import { apiFtdProjects } from 'mastodon/api/freethedream';
import type { FtdProject } from 'mastodon/api_types/freethedream';

import { ProjectComposer } from './project_composer';
import { Loading, ProgressLine, useLoaded } from './shared';

const messages = defineMessages({
  emptyAll: {
    id: 'freethedream.empty.all',
    defaultMessage: 'No projects yet. Start one from the Ж menu.',
  },
  emptyMine: {
    id: 'freethedream.empty.mine',
    defaultMessage: "You haven't joined a project yet.",
  },
  joined: { id: 'freethedream.joined', defaultMessage: 'Joined' },
  asked: { id: 'freethedream.asked_short', defaultMessage: 'Asked' },
});

interface Props {
  scope: 'all' | 'mine';
  composer?: boolean;
}

// Every project, or the ones you're in. /hub/freethedream/composer opens
// "Start a project" over the list (the Ж menu's compose route).
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
        <ul className='freethedream-rows'>
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                to={`/hub/freethedream/p/${p.id}`}
                className='freethedream-row'
              >
                <span className='freethedream-row__title'>
                  {p.title}
                  {p.membership !== 'none' && (
                    <span className='freethedream-tag'>
                      {intl.formatMessage(
                        p.membership === 'member'
                          ? messages.joined
                          : messages.asked,
                      )}
                    </span>
                  )}
                  {p.done && (
                    <span className='freethedream-tag'>
                      <FormattedMessage
                        id='freethedream.done'
                        defaultMessage='Done'
                      />
                    </span>
                  )}
                </span>
                {p.description && (
                  <span className='freethedream-row__body'>
                    {p.description}
                  </span>
                )}
                <span className='freethedream-row__meta'>
                  <FormattedMessage
                    id='freethedream.members_count'
                    defaultMessage='{count, plural, one {# person} other {# people}}'
                    values={{ count: p.members_count }}
                  />
                  {p.location && ` · ${p.location}`}
                  {(p.starts_on ?? p.ends_on) && (
                    <>
                      {' · '}
                      {intl.formatDate(p.starts_on ?? p.ends_on ?? '', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        timeZone: 'UTC',
                      })}
                    </>
                  )}
                </span>
                <ProgressLine progress={p.progress} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {composer && (
        <ProjectComposer onCancel={closeComposer} onSaved={handleSaved} />
      )}
    </div>
  );
};
