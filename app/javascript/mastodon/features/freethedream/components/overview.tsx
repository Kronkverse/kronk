import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import classNames from 'classnames';
import { Link } from 'react-router-dom';

import type { FtdProject } from 'mastodon/api_types/freethedream';

import {
  formatAmount,
  formatNeed,
  Progress,
  projectPath,
  Section,
} from './shared';
import { UpdateList } from './updates';

// Your dashboard on a projekt's page, under its wheel (Tal, 2026-11-26:
// "an overview of what they're signed up to, what they've been tagged in,
// which komponents they're a part of, and any other activity that involves
// them"). Each part is compact, its first few rows fading into See all.
// Nothing shows of a part with nothing in it. Who's in it, joining and
// requests to join are its Krew's page (Tal, 2026-10-30).

const messages = defineMessages({
  newTalk: { id: 'freethedream.dash.new_talk', defaultMessage: 'New talk' },
  newCount: {
    id: 'freethedream.dash.new_count',
    defaultMessage: '{count} new',
  },
  signedUp: {
    id: 'freethedream.dash.signed_up',
    defaultMessage: 'Signed up to',
  },
  tagged: { id: 'freethedream.dash.tagged', defaultMessage: 'Tagged in' },
  komponents: {
    id: 'freethedream.dash.komponents',
    defaultMessage: 'Your Komponents',
  },
  around: { id: 'freethedream.dash.around', defaultMessage: 'Around you' },
  seeAll: {
    id: 'freethedream.dash.see_all',
    defaultMessage: 'See all {count}',
  },
  showLess: { id: 'freethedream.dash.show_less', defaultMessage: 'Show less' },
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
    defaultMessage: 'On it',
  },
  taggedDo: { id: 'freethedream.dash.tagged_do', defaultMessage: 'Do' },
  taggedBring: {
    id: 'freethedream.dash.tagged_bring',
    defaultMessage: 'Bring',
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

// How many rows a part shows before See all.
const SHOWN = 4;

// One part of the dashboard: its first few rows, the last fading, and See
// all to open the rest in place.
const Compact: React.FC<{
  title: string;
  count: number;
  children: (limit: number | undefined) => React.ReactNode;
}> = ({ title, count, children }) => {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const handleToggle = useCallback(() => {
    setOpen((was) => !was);
  }, []);
  if (count === 0) return null;
  const more = count > SHOWN;

  return (
    <Section title={title}>
      <div
        className={classNames('freethedream-compact', {
          'freethedream-compact--faded': more && !open,
        })}
      >
        {children(open ? undefined : SHOWN)}
      </div>
      {more && (
        <button
          type='button'
          className='freethedream__link freethedream-compact__more'
          aria-expanded={open}
          onClick={handleToggle}
        >
          {open
            ? intl.formatMessage(messages.showLess)
            : intl.formatMessage(messages.seeAll, { count })}
        </button>
      )}
    </Section>
  );
};

export const Yours: React.FC<{ project: FtdProject }> = ({ project }) => {
  const intl = useIntl();
  const mine = project.mine;
  if (!mine) return null;

  const unseen = mine.unseen.filter((place) => place.id !== project.id);
  const where = (section: { title: string } | null) =>
    section?.title ?? intl.formatMessage(messages.onTheWhole);

  const signedUp = [
    ...mine.bringing.map((thing) => {
      const counted = thing.about > 1 || thing.unit !== '';
      return (
        <OnYouRow
          key={`bring-${thing.id}`}
          id={thing.id}
          title={thing.title}
          where={where(thing.section)}
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
    }),
    ...mine.jobs.map((job) => (
      <OnYouRow
        key={`job-${job.id}`}
        id={job.id}
        title={job.title}
        where={where(job.section)}
        tag={intl.formatMessage(messages.youActualise)}
      />
    )),
  ];

  const tagged = mine.tagged.map((thing) => (
    <OnYouRow
      key={thing.id}
      id={thing.id}
      title={thing.title}
      where={where(thing.section)}
      tag={intl.formatMessage(
        thing.kind === 'need' ? messages.taggedBring : messages.taggedDo,
      )}
    />
  ));

  const komponents = mine.groups.map((group) => (
    <li key={group.id}>
      <Link
        to={projectPath(group)}
        className='freethedream-row freethedream-row--item'
      >
        <span className='freethedream-row__main'>
          <span className='freethedream-row__title'>{group.title}</span>
          {group.progress.total > 0 && (
            <Progress done={group.progress.sorted} of={group.progress.total} />
          )}
        </span>
        {group.unseen > 0 && (
          <span className='freethedream-row__side'>
            <span className='freethedream-tag freethedream-tag--flush'>
              {intl.formatMessage(messages.newCount, { count: group.unseen })}
            </span>
          </span>
        )}
      </Link>
    </li>
  ));

  const talk = unseen.map((place) => (
    <li key={place.id}>
      <Link to={projectPath(place)}>{place.title}</Link>
      <span className='freethedream-tag'>
        {intl.formatMessage(messages.newCount, { count: place.count })}
      </span>
    </li>
  ));

  return (
    <div className='freethedream-dashboard'>
      <Compact
        title={intl.formatMessage(messages.signedUp)}
        count={signedUp.length}
      >
        {(limit) => (
          <ul className='freethedream-rows'>{signedUp.slice(0, limit)}</ul>
        )}
      </Compact>
      <Compact
        title={intl.formatMessage(messages.tagged)}
        count={tagged.length}
      >
        {(limit) => (
          <ul className='freethedream-rows'>{tagged.slice(0, limit)}</ul>
        )}
      </Compact>
      <Compact
        title={intl.formatMessage(messages.komponents)}
        count={komponents.length}
      >
        {(limit) => (
          <ul className='freethedream-rows'>{komponents.slice(0, limit)}</ul>
        )}
      </Compact>
      <Compact title={intl.formatMessage(messages.newTalk)} count={talk.length}>
        {(limit) => (
          <ul className='freethedream-lines'>{talk.slice(0, limit)}</ul>
        )}
      </Compact>
      <Compact
        title={intl.formatMessage(messages.around)}
        count={mine.around.length}
      >
        {(limit) => (
          <UpdateList
            updates={mine.around.slice(0, limit)}
            hereId={project.id}
            rootId={project.root.id}
          />
        )}
      </Compact>
    </div>
  );
};

// A thing on you: what it is and where it lives on the left, what you're
// doing about it on the right.
const OnYouRow: React.FC<{
  id: string;
  title: string;
  where: string;
  tag: string;
  note?: string;
}> = ({ id, title, where, tag, note }) => (
  <li>
    <Link
      to={`/hub/freethedream/i/${id}`}
      className='freethedream-row freethedream-row--item'
    >
      <span className='freethedream-row__main'>
        <span className='freethedream-row__title'>{title}</span>
        <span className='freethedream-row__meta'>{where}</span>
      </span>
      <span className='freethedream-row__side freethedream-row__side--stack'>
        <span className='freethedream-tag freethedream-tag--flush'>{tag}</span>
        {note && <span className='freethedream-row__meta'>{note}</span>}
      </span>
    </Link>
  </li>
);
