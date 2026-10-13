import { useCallback, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Link, useHistory } from 'react-router-dom';

import {
  apiFtdAnswerRequest,
  apiFtdProjectAction,
} from 'mastodon/api/freethedream';
import type { FtdPersonRow, FtdProject } from 'mastodon/api_types/freethedream';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerPill } from 'mastodon/components/korner_pill';

import {
  DATE,
  EventCard,
  EventLinker,
  eventMapHref,
  eventWhen,
} from './event_card';
import { GroupTiles } from './groups';
import { Invite } from './invite';
import { Person, ProgressLine } from './shared';
import { Updates } from './updates';

// A project's Overview, where it opens: when and where it is, who's in it
// and what each is on, what it's about, its working groups and what's
// happened lately. The work itself is in Kontribute (Tal, 2026-10-13).

const LATEST = 5;
const FACE_MAX = 5;

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
  threads: {
    id: 'freethedream.kontribute.threads',
    defaultMessage:
      '{count, plural, one {# open thread} other {# open threads}}',
  },
  nothingYet: {
    id: 'freethedream.kontribute.empty',
    defaultMessage: 'Nothing listed yet.',
  },
  when: { id: 'freethedream.facts.when', defaultMessage: 'When' },
  where: { id: 'freethedream.facts.where', defaultMessage: 'Where' },
  who: { id: 'freethedream.facts.who', defaultMessage: 'Who' },
  groupsFact: {
    id: 'freethedream.facts.groups',
    defaultMessage: 'Working groups',
  },
  notSet: { id: 'freethedream.facts.not_set', defaultMessage: 'Not set yet' },
  by: { id: 'freethedream.facts.by', defaultMessage: 'Wrapping up by' },
  peopleCount: {
    id: 'freethedream.members_count',
    defaultMessage: '{count, plural, one {# person} other {# people}}',
  },
  groupsNone: {
    id: 'freethedream.facts.groups_none',
    defaultMessage: 'None yet',
  },
  organiser: {
    id: 'freethedream.person.organiser',
    defaultMessage: 'Organiser',
  },
  leads: { id: 'freethedream.person.leads', defaultMessage: 'Leads {groups}' },
  jobs: {
    id: 'freethedream.person.jobs',
    defaultMessage: '{count, plural, one {# job} other {# jobs}}',
  },
  bringing: {
    id: 'freethedream.person.bringing',
    defaultMessage: 'bringing {count, plural, one {# thing} other {# things}}',
  },
  workedOn: {
    id: 'freethedream.overview.groups',
    defaultMessage: 'What’s being worked on',
  },
  noGroups: {
    id: 'freethedream.overview.no_groups',
    defaultMessage: 'No working groups yet. Start one in Kontribute.',
  },
});

// A titled fact at the top of the Overview: When, Where, Who.
const Fact: React.FC<{
  label: string;
  children: React.ReactNode;
  sub?: React.ReactNode;
}> = ({ label, children, sub }) => (
  <div className='freethedream-fact'>
    <dt className='freethedream-fact__label'>{label}</dt>
    <dd className='freethedream-fact__value'>{children}</dd>
    {sub && <dd className='freethedream-fact__sub'>{sub}</dd>}
  </div>
);

// One person and what they're on: "Organiser", "Leads Kitchen",
// "2 jobs · bringing 3 things".
const PersonRow: React.FC<{ row: FtdPersonRow }> = ({ row }) => {
  const intl = useIntl();
  const roles = [
    row.organiser && intl.formatMessage(messages.organiser),
    row.leads.length > 0 &&
      intl.formatMessage(messages.leads, {
        groups: intl.formatList(row.leads.map((g) => g.title)),
      }),
    row.jobs > 0 && intl.formatMessage(messages.jobs, { count: row.jobs }),
    row.bringing > 0 &&
      intl.formatMessage(messages.bringing, { count: row.bringing }),
  ].filter(Boolean);

  return (
    <li className='freethedream-member'>
      <Person account={row.account} />
      {roles.length > 0 && (
        <span className='freethedream-member__role'>{roles.join(' · ')}</span>
      )}
    </li>
  );
};

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

  const when = project.event ? eventWhen(intl, project.event) : null;
  const mapHref = project.event ? eventMapHref(project.event) : null;

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
        <dl className='freethedream-facts'>
          <Fact
            label={intl.formatMessage(messages.when)}
            sub={
              when?.time ??
              (!project.event &&
                project.ends_on &&
                intl.formatMessage(messages.by))
            }
          >
            {when?.date ??
              (project.ends_on ? (
                intl.formatDate(project.ends_on, {
                  ...DATE,
                  timeZone: 'UTC',
                })
              ) : (
                <span className='freethedream-fact__unset'>
                  {intl.formatMessage(messages.notSet)}
                </span>
              ))}
          </Fact>
          <Fact label={intl.formatMessage(messages.where)}>
            {project.event?.location_name ? (
              mapHref ? (
                <Link to={mapHref}>{project.event.location_name}</Link>
              ) : (
                project.event.location_name
              )
            ) : (
              <span className='freethedream-fact__unset'>
                {intl.formatMessage(messages.notSet)}
              </span>
            )}
          </Fact>
          <Fact
            label={intl.formatMessage(messages.who)}
            sub={
              <span className='freethedream-faces' aria-hidden='true'>
                {project.members.slice(0, FACE_MAX).map((a) => (
                  <img key={a.id} src={a.avatar} alt='' />
                ))}
              </span>
            }
          >
            {intl.formatMessage(messages.peopleCount, {
              count: project.members_count,
            })}
          </Fact>
          <Fact
            label={intl.formatMessage(messages.groupsFact)}
            sub={
              project.progress.total > 0 && (
                <ProgressLine progress={project.progress} />
              )
            }
          >
            {project.sections.length > 0 ? (
              <Link to={`/hub/freethedream/p/${project.id}/kontribute`}>
                {project.sections.length}
              </Link>
            ) : (
              <span className='freethedream-fact__unset'>
                {intl.formatMessage(messages.groupsNone)}
              </span>
            )}
          </Fact>
        </dl>

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

        <section className='freethedream-section'>
          <header className='freethedream-section__head'>
            <h3 className='freethedream-section__title'>
              {intl.formatMessage(messages.workedOn)}
            </h3>
          </header>
          {project.sections.length > 0 ? (
            <GroupTiles sections={project.sections} />
          ) : (
            <p className='freethedream__quiet'>
              {intl.formatMessage(messages.noGroups)}
            </p>
          )}
        </section>

        <Updates
          updates={project.updates.slice(0, LATEST)}
          hereId={project.id}
        />
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
          <ul className='freethedream-members'>
            {project.people.map((row) => (
              <PersonRow key={row.account?.id ?? 'gone'} row={row} />
            ))}
          </ul>
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
          {(project.progress.total === 0 || openThreads > 0) && (
            <p className='freethedream__quiet'>
              {project.progress.total === 0
                ? intl.formatMessage(messages.nothingYet)
                : intl.formatMessage(messages.threads, { count: openThreads })}
            </p>
          )}
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
