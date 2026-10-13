import { useCallback, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import {
  apiFtdAnswerRequest,
  apiFtdProjectAction,
} from 'mastodon/api/freethedream';
import type {
  FtdPersonRow,
  FtdProject,
  FtdStillNeeded,
} from 'mastodon/api_types/freethedream';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerPill } from 'mastodon/components/korner_pill';

import { EventCard, EventLinker } from './event_card';
import { GroupTiles } from './groups';
import { Invite } from './invite';
import { Person, Section, formatAmount, kindMessages } from './shared';
import { Updates } from './updates';

// A project's Overview, where it opens: a dashboard. For someone in the
// project it leads with what's theirs: talk they haven't seen, the working
// groups they have a hand in, the jobs they've taken and what they're
// bringing, and what's still needed in their groups. Then the rest of the
// working groups and what's happened lately, with the event, requests and
// people beside it. Someone looking in sees the groups, the event and the
// people, and can join (Tal, 2026-10-13).

const LATEST = 5;

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
  newTalk: { id: 'freethedream.dash.new_talk', defaultMessage: 'New talk' },
  newCount: {
    id: 'freethedream.dash.new_count',
    defaultMessage: '{count} new',
  },
  yourGroups: {
    id: 'freethedream.dash.your_groups',
    defaultMessage: 'Your working groups',
  },
  noGroupsYet: {
    id: 'freethedream.dash.no_groups_yet',
    defaultMessage:
      'You’re not in a working group yet. Open one below and pick something up.',
  },
  onYou: { id: 'freethedream.dash.on_you', defaultMessage: 'On you' },
  youBring: {
    id: 'freethedream.dash.bringing',
    defaultMessage: 'Bringing {amount}',
  },
  needed: {
    id: 'freethedream.dash.needed',
    defaultMessage: 'Still needed in your groups',
  },
  allNeeded: {
    id: 'freethedream.dash.all_needed',
    defaultMessage: 'All {count} in Kontribute',
  },
  left: { id: 'freethedream.left', defaultMessage: '{amount} left' },
  openSlots: {
    id: 'freethedream.open_slots',
    defaultMessage:
      '{count, plural, one {# person needed} other {# people needed}}',
  },
  otherGroups: {
    id: 'freethedream.dash.other_groups',
    defaultMessage: 'Other working groups',
  },
  allGroups: {
    id: 'freethedream.working_groups',
    defaultMessage: 'Working groups',
  },
  noGroups: {
    id: 'freethedream.overview.no_groups',
    defaultMessage: 'No working groups yet. Start one in Kontribute.',
  },
});

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

// What's left on a need or a job: "18 left", "1 person needed".
const NeededLine: React.FC<{ item: FtdStillNeeded }> = ({ item }) => {
  const intl = useIntl();
  const what =
    item.kind === 'job'
      ? intl.formatMessage(messages.openSlots, {
          count: Math.max(item.quantity - (item.claimed ?? 0), 0),
        })
      : intl.formatMessage(messages.left, {
          amount: formatAmount(item.left ?? item.quantity, item.unit),
        });

  return (
    <li>
      <Link to={`/hub/freethedream/i/${item.id}`}>{item.title}</Link>
      <span className='freethedream-lines__note'>
        {[what, item.section?.title].filter(Boolean).join(' · ')}
      </span>
    </li>
  );
};

export const Overview: React.FC<{
  project: FtdProject;
  onChange: (p: FtdProject) => void;
  refresh: () => void;
  actions: React.ReactNode;
}> = ({ project, onChange, refresh, actions }) => {
  const intl = useIntl();
  const [inviting, setInviting] = useState(false);
  const [invited, setInvited] = useState<number | null>(null);

  const member = project.membership === 'member';

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

  const mine = project.mine;
  const mineIds = new Set(mine?.groups.map((g) => g.id));
  const others = project.sections.filter((g) => !mineIds.has(g.id));
  const kontribute = `/hub/freethedream/p/${project.id}/kontribute`;

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
        {mine && mine.unseen.length > 0 && (
          <Section title={intl.formatMessage(messages.newTalk)}>
            <ul className='freethedream-lines'>
              {mine.unseen.map((place) => (
                <li key={place.id}>
                  <Link
                    to={
                      place.id === project.id
                        ? kontribute
                        : `/hub/freethedream/p/${place.id}`
                    }
                  >
                    {place.title}
                  </Link>
                  <span className='freethedream-tag'>
                    {intl.formatMessage(messages.newCount, {
                      count: place.count,
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {mine && (
          <Section title={intl.formatMessage(messages.yourGroups)}>
            {mine.groups.length > 0 ? (
              <GroupTiles sections={mine.groups} />
            ) : (
              <p className='freethedream__quiet'>
                {intl.formatMessage(messages.noGroupsYet)}
              </p>
            )}
          </Section>
        )}

        {mine && mine.jobs.length + mine.bringing.length > 0 && (
          <Section title={intl.formatMessage(messages.onYou)}>
            <ul className='freethedream-lines'>
              {mine.jobs.map((job) => (
                <li key={`job-${job.id}`}>
                  <Link to={`/hub/freethedream/i/${job.id}`}>{job.title}</Link>
                  <span className='freethedream-lines__note'>
                    {intl.formatMessage(kindMessages.job)}
                  </span>
                </li>
              ))}
              {mine.bringing.map((thing) => (
                <li key={`bring-${thing.id}`}>
                  <Link to={`/hub/freethedream/i/${thing.id}`}>
                    {thing.title}
                  </Link>
                  <span className='freethedream-lines__note'>
                    {intl.formatMessage(messages.youBring, {
                      amount: formatAmount(thing.quantity, thing.unit),
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {mine && mine.needed.length > 0 && (
          <Section
            title={intl.formatMessage(messages.needed)}
            aside={
              mine.needed_count > mine.needed.length && (
                <Link to={kontribute} className='freethedream__link'>
                  {intl.formatMessage(messages.allNeeded, {
                    count: mine.needed_count,
                  })}
                </Link>
              )
            }
          >
            <ul className='freethedream-lines'>
              {mine.needed.map((item) => (
                <NeededLine key={item.id} item={item} />
              ))}
            </ul>
          </Section>
        )}

        {(others.length > 0 || !mine) && (
          <Section
            title={intl.formatMessage(
              mine && mine.groups.length > 0
                ? messages.otherGroups
                : messages.allGroups,
            )}
          >
            {others.length > 0 ? (
              <GroupTiles sections={others} />
            ) : (
              <p className='freethedream__quiet'>
                {intl.formatMessage(messages.noGroups)}
              </p>
            )}
          </Section>
        )}

        <Updates
          updates={project.updates.slice(0, LATEST)}
          hereId={project.id}
        />

        {project.source_idea && (
          <p className='freethedream__quiet'>
            <FormattedMessage
              id='freethedream.from_idea'
              defaultMessage='Started from the idea {idea}'
              values={{
                idea: (
                  <Link to={`/hub/freethedream/i/${project.source_idea.id}`}>
                    {project.source_idea.title}
                  </Link>
                ),
              }}
            />
          </p>
        )}
      </div>

      <aside className='freethedream-layout__aside'>
        {project.event ? (
          <EventCard event={project.event} onChange={refresh} />
        ) : (
          project.can.link_event && (
            <EventLinker projectId={project.id} onLinked={refresh} />
          )
        )}

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
