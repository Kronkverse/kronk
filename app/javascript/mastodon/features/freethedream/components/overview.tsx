import { useCallback, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Link, useHistory } from 'react-router-dom';

import {
  apiFtdAnswerRequest,
  apiFtdProjectAction,
} from 'mastodon/api/freethedream';
import type { FtdProject } from 'mastodon/api_types/freethedream';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerPill } from 'mastodon/components/korner_pill';

import { EventCard, EventLinker } from './event_card';
import { Invite } from './invite';
import { People, Person, ProgressLine } from './shared';

// A project's Overview, where it opens: what it is, the event it happens
// at, who's in it, and how the work is going. The work itself is in
// Kontribute (Tal, 2026-10-13).

const messages = defineMessages({
  join: { id: 'freethedream.join', defaultMessage: 'Join' },
  ask: { id: 'freethedream.ask', defaultMessage: 'Ask to join' },
  asked: { id: 'freethedream.asked', defaultMessage: 'Asked · Withdraw' },
  leave: { id: 'freethedream.leave', defaultMessage: 'Leave' },
  getInvolved: {
    id: 'freethedream.get_involved',
    defaultMessage:
      'Want to get involved? Join, then pick up anything in Kontribute.',
  },
  invite: {
    id: 'freethedream.invite.button',
    defaultMessage: 'Invite to have a look',
  },
  invited: {
    id: 'freethedream.invite.sent',
    defaultMessage:
      '{count, plural, =0 {Everyone you picked is already in.} one {Invited # person.} other {Invited # people.}}',
  },
  people: { id: 'freethedream.people', defaultMessage: 'People' },
  requests: { id: 'freethedream.requests', defaultMessage: 'Asking to join' },
  accept: { id: 'freethedream.accept', defaultMessage: 'Accept' },
  notNow: { id: 'freethedream.not_now', defaultMessage: 'Not now' },
  kontribute: { id: 'freethedream.kontribute', defaultMessage: 'Kontribute' },
  openKontribute: {
    id: 'freethedream.kontribute.open',
    defaultMessage: 'Open Kontribute',
  },
  groups: {
    id: 'freethedream.kontribute.groups',
    defaultMessage:
      '{count, plural, one {# working group} other {# working groups}}',
  },
  threads: {
    id: 'freethedream.kontribute.threads',
    defaultMessage:
      '{count, plural, one {# open thread} other {# open threads}}',
  },
  nothingYet: {
    id: 'freethedream.kontribute.empty',
    defaultMessage: 'Nothing listed yet.',
  },
});

// A titled block in the Overview's side column.
const Panel: React.FC<{
  title: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <section className='freethedream-panel'>
    <h3 className='freethedream-panel__title'>{title}</h3>
    {children}
  </section>
);

export const Overview: React.FC<{
  project: FtdProject;
  onChange: (p: FtdProject) => void;
  refresh: () => void;
  actions: React.ReactNode;
}> = ({ project, onChange, refresh, actions }) => {
  const intl = useIntl();
  const history = useHistory();
  const [inviting, setInviting] = useState(false);
  const [invited, setInvited] = useState<number | null>(null);

  const member = project.membership === 'member';
  const openThreads = project.comments.filter(
    (c) => !c.resolved && !c.removed,
  ).length;

  const handleMembership = useCallback(() => {
    const action = project.membership === 'none' ? 'join' : 'leave';
    void apiFtdProjectAction(project.id, action).then(onChange);
  }, [project.id, project.membership, onChange]);

  const handleAnswer = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const { id, answer } = e.currentTarget.dataset;
      if (!id) return;
      void apiFtdAnswerRequest(
        project.id,
        id,
        answer === 'accept' ? 'accept' : 'decline',
      ).then(onChange);
    },
    [project.id, onChange],
  );

  const openKontribute = useCallback(() => {
    history.push(`/hub/freethedream/p/${project.id}/kontribute`);
  }, [history, project.id]);
  const openInvite = useCallback(() => {
    setInvited(null);
    setInviting(true);
  }, []);
  const closeInvite = useCallback(() => {
    setInviting(false);
  }, []);
  const handleSent = useCallback((count: number) => {
    setInviting(false);
    setInvited(count);
  }, []);

  const membershipLabel =
    project.membership === 'member'
      ? messages.leave
      : project.membership === 'requested'
        ? messages.asked
        : project.joining === 'open'
          ? messages.join
          : messages.ask;

  return (
    <div className='freethedream-layout'>
      <div className='freethedream-layout__main'>
        {(project.description || project.source_idea) && (
          <section className='freethedream-about'>
            {project.description && (
              <p className='freethedream-about__text'>{project.description}</p>
            )}
            {project.source_idea && (
              <p className='freethedream__quiet'>
                <FormattedMessage
                  id='freethedream.from_idea'
                  defaultMessage='Started from the idea {idea}'
                  values={{
                    idea: (
                      <Link
                        to={`/hub/freethedream/i/${project.source_idea.id}`}
                      >
                        {project.source_idea.title}
                      </Link>
                    ),
                  }}
                />
              </p>
            )}
          </section>
        )}

        {project.event ? (
          <EventCard event={project.event} onChange={refresh} />
        ) : (
          project.can.link_event && (
            <EventLinker projectId={project.id} onLinked={refresh} />
          )
        )}
      </div>

      <aside className='freethedream-layout__aside'>
        <Panel
          title={
            <>
              {intl.formatMessage(messages.people)}{' '}
              <span className='freethedream-panel__count'>
                {project.members_count}
              </span>
            </>
          }
        >
          <People accounts={project.members} />
          {project.membership === 'none' && (
            <p className='freethedream__quiet'>
              {intl.formatMessage(messages.getInvolved)}
            </p>
          )}
          <KornerActionBar>
            <KornerPill
              variant={member ? 'default' : 'primary'}
              label={intl.formatMessage(membershipLabel)}
              onClick={handleMembership}
            />
            {project.can.invite && (
              <KornerPill
                label={intl.formatMessage(messages.invite)}
                onClick={openInvite}
              />
            )}
          </KornerActionBar>
          {invited !== null && (
            <p className='freethedream__quiet' role='status'>
              {intl.formatMessage(messages.invited, { count: invited })}
            </p>
          )}
        </Panel>

        {project.requests.length > 0 && (
          <Panel title={intl.formatMessage(messages.requests)}>
            <ul className='freethedream-rows'>
              {project.requests.map((a) => (
                <li key={a.id} className='freethedream-request'>
                  <Person account={a} />
                  <span className='freethedream-request__answer'>
                    <button
                      type='button'
                      className='freethedream__button freethedream__button--small'
                      data-id={a.id}
                      data-answer='accept'
                      onClick={handleAnswer}
                    >
                      {intl.formatMessage(messages.accept)}
                    </button>
                    <button
                      type='button'
                      className='freethedream__link'
                      data-id={a.id}
                      data-answer='decline'
                      onClick={handleAnswer}
                    >
                      {intl.formatMessage(messages.notNow)}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Panel title={intl.formatMessage(messages.kontribute)}>
          {project.progress.total > 0 ? (
            <ProgressLine progress={project.progress} />
          ) : (
            <p className='freethedream__quiet'>
              {intl.formatMessage(messages.nothingYet)}
            </p>
          )}
          <p className='freethedream__quiet'>
            {intl.formatMessage(messages.groups, {
              count: project.sections.length,
            })}
            {openThreads > 0 &&
              ` · ${intl.formatMessage(messages.threads, { count: openThreads })}`}
          </p>
          <KornerActionBar>
            <KornerPill
              variant='primary'
              label={intl.formatMessage(messages.openKontribute)}
              onClick={openKontribute}
            />
          </KornerActionBar>
        </Panel>

        {actions}
      </aside>

      {inviting && (
        <Invite
          projectId={project.id}
          title={project.title}
          onSent={handleSent}
          onCancel={closeInvite}
        />
      )}
    </div>
  );
};
