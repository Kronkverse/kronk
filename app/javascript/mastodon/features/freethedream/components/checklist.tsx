import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';
import type { MessageDescriptor } from 'react-intl';

import classNames from 'classnames';

import { apiFtdItemAction } from 'mastodon/api/freethedream';
import type {
  FtdItemRow,
  FtdProject,
  FtdTask,
} from 'mastodon/api_types/freethedream';
import { PeopleRow } from 'mastodon/components/people_row';

import { act } from './act';
import { BringControl } from './bring';
import { QuickAdd } from './quick_add';
import type { QuickAddKind } from './quick_add';
import { Section, formatAmount } from './shared';

// A Komponent's checklist (docs/spaces/freethedream.md, The checklist; Tal,
// 2026-11-10: "Checklist seems sensible, and then we can have variations
// in what sort of things each entry is"). One list; each entry is a kind
// with its own small action: a To do is ticked off, and anyone can say
// they're on it; something to Bring is "I'll bring it"; Pay and Book are
// To dos that say so ("I'll pay it", Paid; "I'll book it", Booked), and a
// Pay can have an amount. What's not done comes first. Decide comes next.

const messages = defineMessages({
  title: { id: 'freethedream.checklist.title', defaultMessage: 'Checklist' },
  todo: { id: 'freethedream.checklist.todo', defaultMessage: 'To do' },
  bring: { id: 'freethedream.checklist.bring', defaultMessage: 'Bring' },
  pay: { id: 'freethedream.checklist.pay', defaultMessage: 'Pay' },
  book: { id: 'freethedream.checklist.book', defaultMessage: 'Book' },
  addKind: {
    id: 'freethedream.checklist.add_kind',
    defaultMessage: 'Add to the checklist as',
  },
  tick: { id: 'freethedream.checklist.tick', defaultMessage: 'Done' },
  tickPay: { id: 'freethedream.checklist.tick_pay', defaultMessage: 'Paid' },
  tickBook: {
    id: 'freethedream.checklist.tick_book',
    defaultMessage: 'Booked',
  },
  untick: {
    id: 'freethedream.checklist.untick',
    defaultMessage: 'Not done yet',
  },
  onIt: { id: 'freethedream.checklist.on_it', defaultMessage: 'I’m on it' },
  onItPay: {
    id: 'freethedream.checklist.on_it_pay',
    defaultMessage: 'I’ll pay it',
  },
  onItBook: {
    id: 'freethedream.checklist.on_it_book',
    defaultMessage: 'I’ll book it',
  },
  offIt: { id: 'freethedream.checklist.off_it', defaultMessage: 'Off it' },
  money: {
    id: 'freethedream.checklist.money',
    defaultMessage: '{total} to pay, {paid} of it paid',
  },
  empty: {
    id: 'freethedream.checklist.empty',
    defaultMessage: 'Nothing on it yet. Add the first thing below.',
  },
});

// What each kind of To do says.
const TASK_WORDS: Record<
  FtdTask,
  { label: MessageDescriptor; tick: MessageDescriptor; onIt: MessageDescriptor }
> = {
  todo: { label: messages.todo, tick: messages.tick, onIt: messages.onIt },
  pay: { label: messages.pay, tick: messages.tickPay, onIt: messages.onItPay },
  book: {
    label: messages.book,
    tick: messages.tickBook,
    onIt: messages.onItBook,
  },
};

// The kinds to add, in the order they're offered.
const ADD_KINDS: { kind: QuickAddKind; label: MessageDescriptor }[] = [
  { kind: 'job', label: messages.todo },
  { kind: 'need', label: messages.bring },
  { kind: 'pay', label: messages.pay },
  { kind: 'book', label: messages.book },
];

const taskOf = (item: FtdItemRow): FtdTask => item.task ?? 'todo';

const isDone = (item: FtdItemRow) =>
  item.kind === 'need' ? (item.left ?? 1) === 0 : !!item.done;

// A Pay entry's amount, if it has one.
const dollars = (item: FtdItemRow) =>
  item.kind === 'job' && taskOf(item) === 'pay' && item.unit === '$'
    ? item.quantity
    : 0;

const ToDo: React.FC<{
  item: FtdItemRow;
  canAct: boolean;
  onChange: () => void;
}> = ({ item, canAct, onChange }) => {
  const intl = useIntl();
  const words = TASK_WORDS[taskOf(item)];
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
  const amount = dollars(item);

  return (
    <>
      <input
        type='checkbox'
        className='freethedream-checklist__tick'
        checked={done}
        disabled={!canAct}
        onChange={handleTick}
        aria-label={intl.formatMessage(done ? messages.untick : words.tick)}
      />
      <span className='freethedream-checklist__title'>{item.title}</span>
      {amount > 0 && (
        <span className='freethedream-checklist__amount'>
          {formatAmount(amount, '$')}
        </span>
      )}
      {done && taskOf(item) !== 'todo' && (
        <span className='freethedream-checklist__state'>
          {intl.formatMessage(words.tick)}
        </span>
      )}
      <PeopleRow people={people} max={3} />
      {canAct && !done && (
        <button
          type='button'
          className='freethedream__link freethedream-checklist__on'
          onClick={handleOnIt}
        >
          {intl.formatMessage(item.claimed_by_me ? messages.offIt : words.onIt)}
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
          item.kind === 'need'
            ? messages.bring
            : TASK_WORDS[taskOf(item)].label,
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

const KindButton: React.FC<{
  kind: QuickAddKind;
  label: MessageDescriptor;
  on: boolean;
  onPick: (kind: QuickAddKind) => void;
}> = ({ kind, label, on, onPick }) => {
  const intl = useIntl();
  const handleClick = useCallback(() => {
    onPick(kind);
  }, [kind, onPick]);

  return (
    <button type='button' aria-pressed={on} onClick={handleClick}>
      {intl.formatMessage(label)}
    </button>
  );
};

export const Checklist: React.FC<{
  project: FtdProject;
  onChange: () => void;
}> = ({ project, onChange }) => {
  const intl = useIntl();
  const [kind, setKind] = useState<QuickAddKind>('job');
  const canAct = project.can.add;

  const entries = project.items
    .filter((item) => item.kind === 'job' || item.kind === 'need')
    // Not done first, each half in the order they were added.
    .map((item, at) => ({ item, at }))
    .sort(
      (a, b) => Number(isDone(a.item)) - Number(isDone(b.item)) || a.at - b.at,
    )
    .map(({ item }) => item);

  // What there is to pay, and how much of it is paid.
  const total = entries.reduce((sum, item) => sum + dollars(item), 0);
  const paid = entries.reduce(
    (sum, item) => sum + (item.done ? dollars(item) : 0),
    0,
  );

  return (
    <Section title={intl.formatMessage(messages.title)}>
      {total > 0 && (
        <p className='freethedream-checklist__money'>
          {intl.formatMessage(messages.money, {
            total: formatAmount(total, '$'),
            paid: formatAmount(paid, '$'),
          })}
        </p>
      )}
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
            {ADD_KINDS.map((k) => (
              <KindButton
                key={k.kind}
                kind={k.kind}
                label={k.label}
                on={kind === k.kind}
                onPick={setKind}
              />
            ))}
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
