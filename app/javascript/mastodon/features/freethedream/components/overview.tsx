import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import {
  apiFtdAnswerRequest,
  apiFtdProjectAction,
} from 'mastodon/api/freethedream';
import type { FtdProject } from 'mastodon/api_types/freethedream';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerPill } from 'mastodon/components/korner_pill';

import { EventCard, EventLinker } from './event_card';
import { Invite } from './invite';
import { Person, Section, formatAmount, kindMessages } from './shared';

// The parts of a project's page that are about the project as a whole and
// about you in it. There is one page (Tal, 2026-10-13: "we can probably
// just do it all from the one page"): `Yours` leads it for someone in the
// project (talk they haven't seen in its sections, the jobs they've taken,
// what they're bringing), and `ProjectAside` sits beside it: the Kalendar
// event, requests to join, and joining and inviting. Who's in it is the
// Dreamers row (dreamers.tsx).

const messages = defineMessages({
  join: { id: 'freethedream.join', defaultMessage: 'Join' },
  ask: { id: 'freethedream.ask', defaultMessage: 'Ask to join' },
  asked: { id: 'freethedream.asked', defaultMessage: 'Asked · Withdraw' },
  leave: { id: 'freethedream.leave', defaultMessage: 'Leave' },
  getInvolved: {
    id: 'freethedream.get_involved_here',
    defaultMessage: 'Want to get involved? Join, then pick up anything here.',
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
  requests: { id: 'freethedream.requests', defaultMessage: 'Asking to join' },
  accept: { id: 'freethedream.accept', defaultMessage: 'Accept' },
  notNow: { id: 'freethedream.not_now', defaultMessage: 'Not now' },
  newTalk: { id: 'freethedream.dash.new_talk', defaultMessage: 'New talk' },
  newCount: {
    id: 'freethedream.dash.new_count',
    defaultMessage: '{count} new',
  },
  onYou: { id: 'freethedream.dash.on_you', defaultMessage: 'On you' },
  youBring: {
    id: 'freethedream.dash.bringing',
    defaultMessage: 'Bringing {amount}',
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

// What's yours in the project, above the work: sections with talk you
// haven't seen (this page's own talk is beside you already), the jobs
// you've taken and what you're bringing. Nothing shows when there's none.
export const Yours: React.FC<{ project: FtdProject }> = ({ project }) => {
  const intl = useIntl();
  const mine = project.mine;
  if (!mine) return null;

  const unseen = mine.unseen.filter((place) => place.id !== project.id);

  return (
    <>
      {unseen.length > 0 && (
        <Section title={intl.formatMessage(messages.newTalk)}>
          <ul className='freethedream-lines'>
            {unseen.map((place) => (
              <li key={place.id}>
                <Link to={`/hub/freethedream/p/${place.id}`}>
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

      {mine.jobs.length + mine.bringing.length > 0 && (
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
    </>
  );
};

// Beside the work on a project's page: its Kalendar event, who's asking
// to join (for the owner), and the people with Join and Invite.
export const ProjectAside: React.FC<{
  project: FtdProject;
  onChange: (p: FtdProject) => void;
  refresh: () => void;
}> = ({ project, onChange, refresh }) => {
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

  const membershipLabel =
    project.membership === 'member'
      ? messages.leave
      : project.membership === 'requested'
        ? messages.asked
        : project.joining === 'open'
          ? messages.join
          : messages.ask;

  return (
    <>
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

      <section className='freethedream-panel'>
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
      </section>

      {inviting && (
        <Invite
          projectId={project.id}
          title={project.title}
          onSent={handleSent}
          onCancel={closeInvite}
        />
      )}
    </>
  );
};
