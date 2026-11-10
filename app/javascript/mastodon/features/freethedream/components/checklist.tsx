import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import classNames from 'classnames';

import { apiFtdItemAction } from 'mastodon/api/freethedream';
import type { FtdItemRow, FtdProject } from 'mastodon/api_types/freethedream';
import { PeopleRow } from 'mastodon/components/people_row';

import { act } from './act';
import { BringControl } from './bring';
import { QuickAdd } from './quick_add';
import { Section } from './shared';

// A Komponent's checklist (docs/spaces/freethedream.md, The checklist; Tal,
// 2026-11-10: "Checklist seems sensible, and then we can have variations
// in what sort of things each entry is"). One list; each entry is a kind
// with its own small action: a To do is ticked off, and anyone can say
// they're on it; something to Bring is "I'll bring it". What's not done
// comes first. Decide, Pay and Book come next.

const messages = defineMessages({
  title: { id: 'freethedream.checklist.title', defaultMessage: 'Checklist' },
  todo: { id: 'freethedream.checklist.todo', defaultMessage: 'To do' },
  bring: { id: 'freethedream.checklist.bring', defaultMessage: 'Bring' },
  addKind: {
    id: 'freethedream.checklist.add_kind',
    defaultMessage: 'Add to the checklist as',
  },
  tick: { id: 'freethedream.checklist.tick', defaultMessage: 'Done' },
  untick: {
    id: 'freethedream.checklist.untick',
    defaultMessage: 'Not done yet',
  },
  onIt: { id: 'freethedream.checklist.on_it', defaultMessage: 'I’m on it' },
  offIt: { id: 'freethedream.checklist.off_it', defaultMessage: 'Off it' },
  empty: {
    id: 'freethedream.checklist.empty',
    defaultMessage: 'Nothing on it yet. Add the first thing below.',
  },
});

type EntryKind = 'job' | 'need';

const isDone = (item: FtdItemRow) =>
  item.kind === 'need' ? (item.left ?? 1) === 0 : !!item.done;

const ToDo: React.FC<{
  item: FtdItemRow;
  canAct: boolean;
  onChange: () => void;
}> = ({ item, canAct, onChange }) => {
  const intl = useIntl();
  // The tick shows at once; the page's reload after says what stuck.
  const [done, setDone] = useState(!!item.done);
  useEffect(() => {
    setDone(!!item.done);
  }, [item.done]);
  const handleTick = useCallback(() => {
    const next = !done;
    setDone(next);
    void act(apiFtdItemAction(item.id, next ? 'done' : 'undone')).then(
      onChange,
    );
  }, [item.id, done, onChange]);
  const handleOnIt = useCallback(() => {
    void act(
      apiFtdItemAction(item.id, item.claimed_by_me ? 'unclaim' : 'claim'),
    ).then(onChange);
  }, [item.id, item.claimed_by_me, onChange]);
  const people = (item.claimers ?? []).flatMap((a) => (a ? [a] : []));

  return (
    <>
      <input
        type='checkbox'
        className='freethedream-checklist__tick'
        checked={done}
        disabled={!canAct}
        onChange={handleTick}
        aria-label={intl.formatMessage(done ? messages.untick : messages.tick)}
      />
      <span className='freethedream-checklist__title'>{item.title}</span>
      <PeopleRow people={people} max={3} />
      {canAct && !done && (
        <button
          type='button'
          className='freethedream__link freethedream-checklist__on'
          onClick={handleOnIt}
        >
          {intl.formatMessage(
            item.claimed_by_me ? messages.offIt : messages.onIt,
          )}
        </button>
      )}
    </>
  );
};

const Entry: React.FC<{
  item: FtdItemRow;
  canAct: boolean;
  onChange: () => void;
}> = ({ item, canAct, onChange }) => {
  const intl = useIntl();

  return (
    <li
      className={classNames('freethedream-checklist__entry', {
        'freethedream-checklist__entry--done': isDone(item),
      })}
    >
      <span className='freethedream-checklist__kind'>
        {intl.formatMessage(
          item.kind === 'need' ? messages.bring : messages.todo,
        )}
      </span>
      {item.kind === 'need' ? (
        <>
          <span className='freethedream-checklist__title'>{item.title}</span>
          {canAct && <BringControl need={item} onChange={onChange} />}
        </>
      ) : (
        <ToDo item={item} canAct={canAct} onChange={onChange} />
      )}
    </li>
  );
};

export const Checklist: React.FC<{
  project: FtdProject;
  onChange: () => void;
}> = ({ project, onChange }) => {
  const intl = useIntl();
  const [kind, setKind] = useState<EntryKind>('job');
  const pickTodo = useCallback(() => {
    setKind('job');
  }, []);
  const pickBring = useCallback(() => {
    setKind('need');
  }, []);
  const canAct = project.can.add;

  const entries = project.items
    .filter((item) => item.kind === 'job' || item.kind === 'need')
    // Not done first, each half in the order they were added.
    .map((item, at) => ({ item, at }))
    .sort(
      (a, b) => Number(isDone(a.item)) - Number(isDone(b.item)) || a.at - b.at,
    )
    .map(({ item }) => item);

  return (
    <Section title={intl.formatMessage(messages.title)}>
      {entries.length === 0 ? (
        <p className='freethedream__quiet'>
          {intl.formatMessage(messages.empty)}
        </p>
      ) : (
        <ul className='freethedream-checklist'>
          {entries.map((item) => (
            <Entry
              key={item.id}
              item={item}
              canAct={canAct}
              onChange={onChange}
            />
          ))}
        </ul>
      )}
      {canAct && (
        <div className='freethedream-checklist__add'>
          <div
            className='freethedream-checklist__kinds'
            role='group'
            aria-label={intl.formatMessage(messages.addKind)}
          >
            <button
              type='button'
              aria-pressed={kind === 'job'}
              onClick={pickTodo}
            >
              {intl.formatMessage(messages.todo)}
            </button>
            <button
              type='button'
              aria-pressed={kind === 'need'}
              onClick={pickBring}
            >
              {intl.formatMessage(messages.bring)}
            </button>
          </div>
          <QuickAdd
            key={kind}
            kind={kind}
            projectId={project.id}
            onAdded={onChange}
          />
        </div>
      )}
    </Section>
  );
};
