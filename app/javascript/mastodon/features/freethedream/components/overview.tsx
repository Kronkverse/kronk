import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import type { FtdProject } from 'mastodon/api_types/freethedream';

import { EventCard, MakeEventPrompt } from './event_card';
import { formatAmount, formatNeed, projectPath, Section } from './shared';

// The parts of a project's page that are about the project as a whole and
// about you in it. `Yours` leads it for someone in the project (talk they
// haven't seen in its sections, the jobs they've taken, what they're
// bringing), and `ProjectEvent` sits beside it. Who's in it, joining and
// requests to join are its Krew's page (Tal, 2026-10-30).

const messages = defineMessages({
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
    defaultMessage: 'For the whole projekt',
  },
});

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

// A project's or gang's Kalendar event, or for its owner a way to make
// one. The same event shows on the emergence's Krew (Kronk::EventLinks).
export const ProjectEvent: React.FC<{
  project: FtdProject;
  refresh: () => void;
}> = ({ project, refresh }) =>
  project.event ? (
    <EventCard event={project.event} onChange={refresh} />
  ) : project.can.link_event ? (
    <MakeEventPrompt projectId={project.id} />
  ) : null;
