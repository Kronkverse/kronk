import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';
import type { MessageDescriptor } from 'react-intl';

import classNames from 'classnames';

import Overlay from 'react-overlays/Overlay';

import CalendarIcon from '@/material-icons/400-24px/calendar_month.svg?react';
import CheckIcon from '@/material-icons/400-24px/check.svg?react';
import BringIcon from '@/material-icons/400-24px/inventory_2.svg?react';
import PaymentsIcon from '@/material-icons/400-24px/payments.svg?react';
import QuestionIcon from '@/material-icons/400-24px/question_mark.svg?react';
import UnfoldMoreIcon from '@/material-icons/400-24px/unfold_more.svg?react';
import { apiFtdItemAction } from 'mastodon/api/freethedream';
import {
  apiAnswerKuestion,
  apiUpdateMyKuestionAnswer,
} from 'mastodon/api/kuestions';
import type {
  FtdDecide,
  FtdItemRow,
  FtdProject,
  FtdTask,
} from 'mastodon/api_types/freethedream';
import { DropdownSelector } from 'mastodon/components/dropdown_selector';
import type { SelectItem } from 'mastodon/components/dropdown_selector';
import { Icon } from 'mastodon/components/icon';
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
// Pay can have an amount; a Decide is a quick Kuestion in the Komponent,
// its choices picked right on the entry and ticked once it's decided. What's
// not done comes first.

const messages = defineMessages({
  title: { id: 'freethedream.checklist.title', defaultMessage: 'Checklist' },
  todo: { id: 'freethedream.checklist.todo', defaultMessage: 'To do' },
  bring: { id: 'freethedream.checklist.bring', defaultMessage: 'Bring' },
  pay: { id: 'freethedream.checklist.pay', defaultMessage: 'Pay' },
  book: { id: 'freethedream.checklist.book', defaultMessage: 'Book' },
  decide: { id: 'freethedream.checklist.decide', defaultMessage: 'Decide' },
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
  tickDecide: {
    id: 'freethedream.checklist.tick_decide',
    defaultMessage: 'Decided',
  },
  decidedOn: {
    id: 'freethedream.checklist.decided_on',
    defaultMessage: 'Decided: {choice}',
  },
  choices: {
    id: 'freethedream.checklist.choices',
    defaultMessage: 'Pick one',
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
  decide: {
    label: messages.decide,
    tick: messages.tickDecide,
    onIt: messages.onIt,
  },
};

// The kinds to add, in the order they're offered.
// Picked from a small menu on the right of the add box, each kind with its
// icon, not a row of pills (Tal, 2026-11-11: "i really really dont like the
// pill situation"; then "the drop down menu is way larger than it needs to
// be, and it should be on the right hand side of the text box").
const ADD_KINDS: { kind: QuickAddKind; label: MessageDescriptor }[] = [
  { kind: 'job', label: messages.todo },
  { kind: 'need', label: messages.bring },
  { kind: 'pay', label: messages.pay },
  { kind: 'book', label: messages.book },
  { kind: 'decide', label: messages.decide },
];

// Each kind's icon, on its entries and beside the dropdown.
const KIND_ICONS: Record<QuickAddKind, { id: string; icon: typeof CheckIcon }> =
  {
    job: { id: 'check', icon: CheckIcon },
    need: { id: 'inventory_2', icon: BringIcon },
    pay: { id: 'payments', icon: PaymentsIcon },
    book: { id: 'calendar_month', icon: CalendarIcon },
    decide: { id: 'question_mark', icon: QuestionIcon },
  };

const KindIcon: React.FC<{ kind: QuickAddKind }> = ({ kind }) => (
  <Icon id={KIND_ICONS[kind].id} icon={KIND_ICONS[kind].icon} aria-hidden />
);

// An entry's kind, as the dropdown names it.
const kindOf = (item: FtdItemRow): QuickAddKind =>
  item.kind === 'need'
    ? 'need'
    : taskOf(item) === 'todo'
      ? 'job'
      : (taskOf(item) as QuickAddKind);

const taskOf = (item: FtdItemRow): FtdTask => item.task ?? 'todo';

const isDone = (item: FtdItemRow) =>
  item.kind === 'need' ? (item.left ?? 1) === 0 : !!item.done;

// A Pay entry's amount, if it has one.
const dollars = (item: FtdItemRow) =>
  item.kind === 'job' && taskOf(item) === 'pay' && item.unit === '$'
    ? item.quantity
    : 0;

// The choice most picked, if one is ahead.
const leading = (decide: FtdDecide) => {
  const top = Math.max(0, ...decide.options.map((o) => o.count));
  const at = decide.options.filter((o) => o.count === top);
  return top > 0 && at.length === 1 ? at[0]?.label : undefined;
};

const Choice: React.FC<{
  index: number;
  label: string;
  count: number;
  mine: boolean;
  disabled: boolean;
  onPick: (index: number) => void;
}> = ({ index, label, count, mine, disabled, onPick }) => {
  const handleClick = useCallback(() => {
    onPick(index);
  }, [index, onPick]);

  return (
    <button
      type='button'
      aria-pressed={mine}
      disabled={disabled}
      onClick={handleClick}
    >
      {label}
      <span className='freethedream-checklist__count'>{count}</span>
    </button>
  );
};

// A Decide's choices: pick one, or change your pick, right on the entry.
const Choices: React.FC<{
  decide: FtdDecide;
  canAct: boolean;
  onChange: () => void;
}> = ({ decide, canAct, onChange }) => {
  const intl = useIntl();
  const [busy, setBusy] = useState(false);
  const handlePick = useCallback(
    (index: number) => {
      if (index === decide.mine) return;
      setBusy(true);
      const pick =
        decide.mine === null
          ? apiAnswerKuestion(decide.kuestion_id, { choice_index: index })
          : apiUpdateMyKuestionAnswer(decide.kuestion_id, {
              choice_index: index,
            });
      void act(pick).then(() => {
        setBusy(false);
        onChange();
      });
    },
    [decide.kuestion_id, decide.mine, onChange],
  );

  return (
    <div
      className='freethedream-checklist__choices'
      role='group'
      aria-label={intl.formatMessage(messages.choices)}
    >
      {decide.options.map((option, index) => (
        <Choice
          key={option.label}
          index={index}
          label={option.label}
          count={option.count}
          mine={decide.mine === index}
          disabled={!canAct || busy}
          onPick={handlePick}
        />
      ))}
    </div>
  );
};

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
  const decide = taskOf(item) === 'decide' ? item.decide : null;
  const decided = done && decide ? leading(decide) : undefined;

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
          {decided
            ? intl.formatMessage(messages.decidedOn, { choice: decided })
            : intl.formatMessage(words.tick)}
        </span>
      )}
      <PeopleRow people={people} max={3} />
      {canAct && !done && !decide && (
        <button
          type='button'
          className='freethedream__link freethedream-checklist__on'
          onClick={handleOnIt}
        >
          {intl.formatMessage(item.claimed_by_me ? messages.offIt : words.onIt)}
        </button>
      )}
      {decide && !done && (
        <Choices decide={decide} canAct={canAct} onChange={onChange} />
      )}
    </>
  );
};

// What's being added, beside the add box.
// The shared menu (DropdownSelector, styled as the reach menu), opened from
// a button only as wide as the kind it shows.
const KindPick: React.FC<{
  kind: QuickAddKind;
  onPick: (kind: QuickAddKind) => void;
}> = ({ kind, onPick }) => {
  const intl = useIntl();
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const items = useMemo<SelectItem[]>(
    () =>
      ADD_KINDS.map((k) => ({
        value: k.kind,
        text: intl.formatMessage(k.label),
        icon: KIND_ICONS[k.kind].id,
        iconComponent: KIND_ICONS[k.kind].icon,
      })),
    [intl],
  );
  const handleToggle = useCallback(() => {
    setOpen((was) => !was);
  }, []);
  const handleClose = useCallback(() => {
    setOpen(false);
    button.current?.focus();
  }, []);
  const handleChange = useCallback(
    (value: string) => {
      onPick(value as QuickAddKind);
    },
    [onPick],
  );
  const label = intl.formatMessage(
    ADD_KINDS.find((k) => k.kind === kind)?.label ?? messages.todo,
  );

  return (
    <>
      <button
        ref={button}
        type='button'
        className='freethedream-checklist__pick'
        aria-haspopup='listbox'
        aria-expanded={open}
        aria-label={`${intl.formatMessage(messages.addKind)}: ${label}`}
        onClick={handleToggle}
      >
        <KindIcon kind={kind} />
        <span>{label}</span>
        <Icon id='unfold' icon={UnfoldMoreIcon} aria-hidden />
      </button>
      <Overlay
        show={open}
        offset={[0, 4]}
        placement='bottom-end'
        onHide={handleClose}
        flip
        target={button.current}
        popperConfig={{ strategy: 'fixed' }}
      >
        {({ props, placement }) => (
          <div {...props} className='privacy-dropdown__overlay'>
            <div
              className={classNames(
                'dropdown-animation',
                'privacy-dropdown__dropdown',
                'freethedream-checklist__menu',
                placement,
              )}
            >
              <DropdownSelector
                items={items}
                value={kind}
                onClose={handleClose}
                onChange={handleChange}
                classNamePrefix='privacy-dropdown'
              />
            </div>
          </div>
        )}
      </Overlay>
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
        <KindIcon kind={kindOf(item)} />
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
          <QuickAdd
            key={kind}
            kind={kind}
            projectId={project.id}
            onAdded={onChange}
            pick={<KindPick kind={kind} onPick={setKind} />}
          />
        </div>
      )}
    </Section>
  );
};
