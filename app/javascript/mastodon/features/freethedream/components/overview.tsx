import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import {
  apiFtdAnswerRequest,
  apiFtdProjectAction,
} from 'mastodon/api/freethedream';
import type { FtdProject } from 'mastodon/api_types/freethedream';
import { ConfirmDialog } from 'mastodon/components/confirm_dialog';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerPill } from 'mastodon/components/korner_pill';

import { act } from './act';
import { EventCard, EventLinker } from './event_card';
import {
  formatAmount,
  formatNeed,
  Person,
  projectPath,
  Section,
} from './shared';

// The parts of a project's page that are about the project as a whole and
// about you in it. There is one page (Tal, 2026-10-13: "we can probably
// just do it all from the one page"): `Yours` leads it for someone in the
// project (talk they haven't seen in its sections, the jobs they've taken,
// what they're bringing), and `ProjectAside` sits beside it: the Kalendar
// event, requests to join, and joining. Who's in it is the Krew row
// (krew_row.tsx). Inviting is the Ж menu's Invite, as on every space page
// (Tal, 2026-10-16: the button here doubled the moon).

const messages = defineMessages({
  join: { id: 'freethedream.join', defaultMessage: 'Join' },
  ask: { id: 'freethedream.ask', defaultMessage: 'Ask to join' },
  asked: { id: 'freethedream.asked', defaultMessage: 'Asked · Withdraw' },
  leave: { id: 'freethedream.leave', defaultMessage: 'Leave' },
  leaveOwnTitle: {
    id: 'freethedream.leave_own.title',
    defaultMessage: 'Leave {title}?',
  },
  leaveOwnBody: {
    id: 'freethedream.leave_own.body',
    defaultMessage:
      "It's yours. If you leave, it's up for grabs: anyone still in it can take it over.",
  },
  getInvolved: {
    id: 'freethedream.get_involved_here',
    defaultMessage: 'Want to get involved? Join, then pick up anything here.',
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
  youBringIt: {
    id: 'freethedream.dash.bringing_it',
    defaultMessage: 'Bringing',
  },
  youActualise: {
    id: 'freethedream.dash.actualising',
    defaultMessage: 'Actualising',
  },
  ofAtLeast: {
    id: 'freethedream.dash.of_plus',
    defaultMessage: 'of {amount}',
  },
  onTheWhole: {
    id: 'freethedream.dash.on_the_whole',
    defaultMessage: 'For the whole emergence',
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
                <Link to={projectPath(place)}>{place.title}</Link>
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
          <ul className='freethedream-rows'>
            {mine.bringing.map((thing) => {
              const counted = thing.about > 1 || thing.unit !== '';
              return (
                <OnYouRow
                  key={`bring-${thing.id}`}
                  id={thing.id}
                  title={thing.title}
                  where={thing.section?.title}
                  tag={
                    counted
                      ? intl.formatMessage(messages.youBring, {
                          amount: formatAmount(thing.quantity, thing.unit),
                        })
                      : intl.formatMessage(messages.youBringIt)
                  }
                  note={
                    counted
                      ? intl.formatMessage(messages.ofAtLeast, {
                          amount: formatNeed(
                            thing.about,
                            thing.unit,
                            thing.more_welcome,
                          ),
                        })
                      : undefined
                  }
                />
              );
            })}
            {mine.jobs.map((job) => (
              <OnYouRow
                key={`job-${job.id}`}
                id={job.id}
                title={job.title}
                where={job.section?.title}
                tag={intl.formatMessage(messages.youActualise)}
              />
            ))}
          </ul>
        </Section>
      )}
    </>
  );
};

// A thing on you: what it is and where it lives on the left, what you're
// doing about it on the right.
const OnYouRow: React.FC<{
  id: string;
  title: string;
  where?: string;
  tag: string;
  note?: string;
}> = ({ id, title, where, tag, note }) => {
  const intl = useIntl();
  return (
    <li>
      <Link
        to={`/hub/freethedream/i/${id}`}
        className='freethedream-row freethedream-row--item'
      >
        <span className='freethedream-row__main'>
          <span className='freethedream-row__title'>{title}</span>
          <span className='freethedream-row__meta'>
            {where ?? intl.formatMessage(messages.onTheWhole)}
          </span>
        </span>
        <span className='freethedream-row__side freethedream-row__side--stack'>
          <span className='freethedream-tag freethedream-tag--flush'>
            {tag}
          </span>
          {note && <span className='freethedream-row__meta'>{note}</span>}
        </span>
      </Link>
    </li>
  );
};

// A project's or gang's Kalendar event, or the way to link one. The same
// event shows on the emergence's Krew (Kronk::EventLinks).
export const ProjectEvent: React.FC<{
  project: FtdProject;
  refresh: () => void;
}> = ({ project, refresh }) =>
  project.event ? (
    <EventCard event={project.event} onChange={refresh} />
  ) : project.can.link_event ? (
    <EventLinker projectId={project.id} onLinked={refresh} />
  ) : null;

// Beside the work on a project's page: its Kalendar event, who's asking
// to join (the Krew's list; anyone in can answer), and Join.
export const ProjectAside: React.FC<{
  project: FtdProject;
  onChange: (p: FtdProject) => void;
  refresh: () => void;
}> = ({ project, onChange, refresh }) => {
  const intl = useIntl();

  const member = project.membership === 'member';
  // Its owner leaving makes it up for grabs, so they're asked first.
  const [confirmLeave, setConfirmLeave] = useState(false);

  const handleMembership = useCallback(() => {
    if (project.membership === 'member' && project.can.edit) {
      setConfirmLeave(true);
      return;
    }
    const action = project.membership === 'none' ? 'join' : 'leave';
    void act(apiFtdProjectAction(project.id, action).then(onChange));
  }, [project.id, project.membership, project.can.edit, onChange]);
  const handleLeave = useCallback(() => {
    setConfirmLeave(false);
    void act(apiFtdProjectAction(project.id, 'leave').then(onChange));
  }, [project.id, onChange]);
  const cancelLeave = useCallback(() => {
    setConfirmLeave(false);
  }, []);

  const handleAnswer = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const { id, answer } = e.currentTarget.dataset;
      if (!id) return;
      void act(
        apiFtdAnswerRequest(
          project.id,
          id,
          answer === 'accept' ? 'accept' : 'decline',
        ).then(onChange),
      );
    },
    [project.id, onChange],
  );

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
      <ProjectEvent project={project} refresh={refresh} />

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
        </KornerActionBar>
      </section>

      {confirmLeave && (
        <ConfirmDialog
          title={intl.formatMessage(messages.leaveOwnTitle, {
            title: project.title,
          })}
          message={intl.formatMessage(messages.leaveOwnBody)}
          confirmLabel={intl.formatMessage(messages.leave)}
          destructive
          onConfirm={handleLeave}
          onCancel={cancelLeave}
        />
      )}
    </>
  );
};
