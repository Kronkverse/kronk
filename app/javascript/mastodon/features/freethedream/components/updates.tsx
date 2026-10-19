import { useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import { apiFtdActivity } from 'mastodon/api/freethedream';
import type { FtdUpdate } from 'mastodon/api_types/freethedream';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';

import { Section, formatAmount } from './shared';

// What's happened lately, here and in every section inside: who added
// what, who's bringing what, who took a job. It keeps itself up to date
// while the page is open and in view, and what arrives fades in.

const SHOWN = 8;
const EVERY_MS = 20_000;

// Something added belongs to the gang, not to whoever typed it (Tal,
// 2026-10-17: "the Kitchen needs a gas bottle, not Chris"), so it reads
// thing first, "Gas bottle needed", with their avatar beside it. What
// someone does (bringing, jumping on board) still says who.
const messages = defineMessages({
  title: { id: 'freethedream.activity.title', defaultMessage: 'Activity' },
  group_added: {
    id: 'freethedream.activity.group_added',
    defaultMessage: '{what} gang coalesced',
  },
  fractal_added: {
    id: 'freethedream.activity.fractal_added',
    defaultMessage: '{what} fractal added',
  },
  need_added: {
    id: 'freethedream.activity.need_added',
    defaultMessage: '{what} needed',
  },
  job_added: {
    id: 'freethedream.activity.job_added',
    defaultMessage: '{what} to bring to life',
  },
  idea_added: {
    id: 'freethedream.activity.idea_added',
    defaultMessage: '{what} suggested',
  },
  offer_added: {
    id: 'freethedream.activity.offer_added',
    defaultMessage: '{what} on offer',
  },
  bringing: {
    id: 'freethedream.updates.bringing',
    defaultMessage: '{name} is bringing {what}',
  },
  claimed: {
    id: 'freethedream.updates.claimed',
    defaultMessage: '{name} jumped on board {what}',
  },
  taken_on: {
    id: 'freethedream.updates.taken_on',
    defaultMessage: '{name} is making {what} happen',
  },
  done: {
    id: 'freethedream.activity.done',
    defaultMessage: '{what} done',
  },
  someone: { id: 'freethedream.updates.someone', defaultMessage: 'Someone' },
});

// The lines that start with the thing: "Tea towels needed", not "tea
// towels needed".
const thingFirst = new Set<keyof typeof messages>([
  'group_added',
  'fractal_added',
  'need_added',
  'job_added',
  'idea_added',
  'offer_added',
  'done',
]);
const capitalise = (text: string) =>
  text.charAt(0).toLocaleUpperCase() + text.slice(1);

export const Updates: React.FC<{
  updates: FtdUpdate[];
  hereId: string;
  rootId: string;
}> = ({ updates: initial, hereId, rootId }) => {
  const intl = useIntl();
  const [updates, setUpdates] = useState(initial);
  const known = useRef(new Set(initial.map((u) => u.id)));

  // The page reloading the project brings fresh updates with it.
  useEffect(() => {
    setUpdates(initial);
  }, [initial]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      apiFtdActivity(hereId)
        .then(setUpdates)
        .catch(() => undefined);
    }, EVERY_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [hereId]);

  const fresh = new Set(updates.filter((u) => !known.current.has(u.id)));
  useEffect(() => {
    updates.forEach((u) => known.current.add(u.id));
  }, [updates]);

  if (updates.length === 0) return null;

  return (
    <Section title={intl.formatMessage(messages.title)}>
      <ul className='freethedream-updates'>
        {updates.slice(0, SHOWN).map((u) => {
          const title = u.data.title ?? '';
          const name =
            u.account?.display_name ?? intl.formatMessage(messages.someone);
          const what =
            (u.verb === 'need_added' || u.verb === 'bringing') &&
            u.data.quantity &&
            (u.data.quantity > 1 || u.data.unit)
              ? `${formatAmount(u.data.quantity, u.data.unit ?? '')} ${title}`
              : title;
          const target = u.item_id
            ? `/hub/freethedream/i/${u.item_id}`
            : `/hub/freethedream/p/${u.data.section_id ?? u.project.id}`;
          // Added to the emergence, it's a gang; to a gang, a fractal.
          const verb =
            u.verb === 'section_added'
              ? u.project.id === rootId
                ? 'group_added'
                : 'fractal_added'
              : u.verb;
          return (
            <li
              key={u.id}
              className={
                fresh.has(u)
                  ? 'freethedream-updates__row freethedream-updates__row--new'
                  : 'freethedream-updates__row'
              }
            >
              {u.account ? (
                <img
                  className='freethedream-updates__avatar'
                  src={u.account.avatar}
                  alt={name}
                  title={name}
                />
              ) : (
                <span className='freethedream-updates__avatar' />
              )}
              <span className='freethedream-updates__text'>
                <Link to={target}>
                  {intl.formatMessage(messages[verb], {
                    name,
                    what: (
                      <strong className='freethedream-updates__what'>
                        {thingFirst.has(verb) ? capitalise(what) : what}
                      </strong>
                    ),
                  })}
                </Link>
                <span className='freethedream-updates__meta'>
                  {u.project.id !== hereId && `${u.project.title} · `}
                  <RelativeTimestamp timestamp={u.created_at} />
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </Section>
  );
};
