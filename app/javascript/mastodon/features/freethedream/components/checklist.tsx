import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';
import type { MessageDescriptor } from 'react-intl';

import classNames from 'classnames';

import Overlay from 'react-overlays/Overlay';

import CalendarIcon from '@/material-icons/400-24px/calendar_month.svg?react';
import CheckIcon from '@/material-icons/400-24px/check.svg?react';
import BringIcon from '@/material-icons/400-24px/inventory_2.svg?react';
import MoreIcon from '@/material-icons/400-24px/more_horiz.svg?react';
import PaymentsIcon from '@/material-icons/400-24px/payments.svg?react';
import PersonIcon from '@/material-icons/400-24px/person.svg?react';
import QuestionIcon from '@/material-icons/400-24px/question_mark.svg?react';
import UnfoldMoreIcon from '@/material-icons/400-24px/unfold_more.svg?react';
import {
  apiFtdItemAction,
  apiFtdMoveItem,
  apiFtdRemoveItem,
  apiFtdSuggest,
  apiFtdUpdateItem,
} from 'mastodon/api/freethedream';
import type { FtdItemParams } from 'mastodon/api/freethedream';
import {
  apiAnswerKuestion,
  apiUpdateMyKuestionAnswer,
} from 'mastodon/api/kuestions';
import type {
  FtdAccount,
  FtdDecide,
  FtdItemRow,
  FtdProject,
  FtdTask,
} from 'mastodon/api_types/freethedream';
import { ConfirmDialog } from 'mastodon/components/confirm_dialog';
import { DropdownSelector } from 'mastodon/components/dropdown_selector';
import type { SelectItem } from 'mastodon/components/dropdown_selector';
import { Icon } from 'mastodon/components/icon';
import { IconButton } from 'mastodon/components/icon_button';
import { PeopleRow } from 'mastodon/components/people_row';
import { me } from 'mastodon/initial_state';

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
  changeKind: {
    id: 'freethedream.checklist.change_kind',
    defaultMessage: 'Change what kind of entry this is',
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
  removeTitle: {
    id: 'freethedream.checklist.remove_title',
    defaultMessage: 'Take {title} off?',
  },
  removeBody: {
    id: 'freethedream.checklist.remove_body',
    defaultMessage: 'Someone else already has a hand in it.',
  },
  menu: {
    id: 'freethedream.checklist.menu',
    defaultMessage: 'More for {title}',
  },
  moveTo: {
    id: 'freethedream.checklist.move_to',
    defaultMessage: 'Move to…',
  },
  suggest: {
    id: 'freethedream.checklist.suggest',
    defaultMessage: 'Suggest someone…',
  },
  suggested: {
    id: 'freethedream.checklist.suggested',
    defaultMessage: 'Suggested',
  },
  suggestedYou: {
    id: 'freethedream.checklist.suggested_you',
    defaultMessage: 'You’re suggested for this',
  },
  notForMe: {
    id: 'freethedream.checklist.not_for_me',
    defaultMessage: 'Not for me',
  },
  delete: {
    id: 'freethedream.checklist.delete',
    defaultMessage: 'Delete',
  },
  dropHere: {
    id: 'freethedream.checklist.drop_here',
    defaultMessage: 'Drop it here',
  },
  removeConfirm: {
    id: 'freethedream.checklist.remove_confirm',
    defaultMessage: 'Take it off',
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

// What an entry is sent as when its kind is changed.
const RETYPE: Record<QuickAddKind, FtdItemParams> = {
  job: { kind: 'job', task: 'todo' },
  need: { kind: 'need' },
  pay: { kind: 'job', task: 'pay' },
  book: { kind: 'job', task: 'book' },
  decide: { kind: 'job', task: 'decide' },
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

// Whether anyone but you is on it, bringing some or has picked a choice:
// taking it off then asks first.
const othersIn = (item: FtdItemRow) =>
  (item.claimers?.length ?? 0) > (item.claimed_by_me ? 1 : 0) ||
  (item.contributors?.length ?? 0) > (item.my_quantity ? 1 : 0) ||
  (item.decide?.options ?? []).reduce((sum, o) => sum + o.count, 0) >
    (item.decide?.mine != null ? 1 : 0);

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
          className={classNames(
            'freethedream__button',
            'freethedream__button--small',
            'freethedream-checklist__on',
            { 'freethedream__button--quiet': item.claimed_by_me },
          )}
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

// What's being added, beside the add box, and an entry's own kind, which
// whoever added it can tap to change (Kommons "Checklist", 2026-11-18).
// The shared menu (DropdownSelector, styled as the reach menu), opened from
// a button only as wide as the kind it shows.
const KindPick: React.FC<{
  kind: QuickAddKind;
  onPick: (kind: QuickAddKind) => void;
  label: MessageDescriptor;
  className: string;
  disabled?: boolean;
}> = ({ kind, onPick, label: what, className, disabled }) => {
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
  const label = intl.formatMessage(
    ADD_KINDS.find((k) => k.kind === kind)?.label ?? messages.todo,
  );
  const handlePick = useCallback(
    (value: string) => {
      setOpen(false);
      if (value !== kind) onPick(value as QuickAddKind);
    },
    [kind, onPick],
  );

  return (
    <>
      <button
        ref={button}
        type='button'
        className={className}
        aria-haspopup='listbox'
        aria-expanded={open}
        aria-label={`${intl.formatMessage(what)}: ${label}`}
        disabled={disabled}
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
                onChange={handlePick}
                classNamePrefix='privacy-dropdown'
              />
            </div>
          </div>
        )}
      </Overlay>
    </>
  );
};

// Where an entry can go on a Komponent's page: its own checklist and each
// of its fractals' (Kommons "drag and drop/move checklist items",
// 2026-11-22: "be able to move the check list items into fractals").
export interface MoveTarget {
  id: string;
  title: string;
}

export const moveTargets = (project: FtdProject): MoveTarget[] =>
  project.fractals.length > 0
    ? [
        { id: project.id, title: project.title },
        ...project.fractals.map((f) => ({ id: f.id, title: f.title })),
      ]
    : [];

// What a dragged entry carries: which entry, and from which checklist.
const DRAG_TYPE = 'application/x-kronk-checklist-entry';

const move = (itemId: string, fromId: string, toId: string) =>
  act(apiFtdMoveItem(itemId, fromId, toId));

// An entry's ⋯ menu: Suggest someone… (anyone in the projekt, Kommons
// "Tagging people on a checklist item", 2026-11-22), Move to… (when the
// page has other checklists) and Delete, in red, for whoever added it.
// Suggest someone… and Move to… each open their own list in the same menu.
// A drag moves an entry too on a computer; the menu is how it's done on a
// phone, where there is no dragging, and from a keyboard.
const REMOVE = '__remove';
const SUGGEST = '__suggest';
const MOVE = '__move';
type MenuList = 'top' | 'suggest' | 'move';
const EntryMenu: React.FC<{
  item: FtdItemRow;
  fromId: string;
  targets: MoveTarget[];
  // Who can be suggested: everyone else in the projekt.
  people: FtdAccount[];
  removable: boolean;
  disabled: boolean;
  onChange: () => void;
  onRemove: () => void;
}> = ({
  item,
  fromId,
  targets,
  people,
  removable,
  disabled,
  onChange,
  onRemove,
}) => {
  const intl = useIntl();
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<MenuList>('top');
  const suggested = useMemo(
    () => new Set((item.suggested ?? []).map((a) => a.id)),
    [item.suggested],
  );
  const items = useMemo<SelectItem[]>(() => {
    if (list === 'move')
      return targets.map((t) => ({ value: t.id, text: t.title }));
    if (list === 'suggest')
      return people.map((p) => ({
        value: p.id,
        text: p.display_name || p.acct,
        icon: suggested.has(p.id) ? 'check' : 'person',
        iconComponent: suggested.has(p.id) ? CheckIcon : PersonIcon,
      }));
    return [
      ...(people.length > 0
        ? [{ value: SUGGEST, text: intl.formatMessage(messages.suggest) }]
        : []),
      ...(targets.length > 0
        ? [{ value: MOVE, text: intl.formatMessage(messages.moveTo) }]
        : []),
      ...(removable
        ? [{ value: REMOVE, text: intl.formatMessage(messages.delete) }]
        : []),
    ];
  }, [list, targets, people, suggested, removable, intl]);
  const handleToggle = useCallback(() => {
    setList('top');
    setOpen((was) => !was);
  }, []);
  const handleClose = useCallback(() => {
    setOpen(false);
    button.current?.focus();
  }, []);
  const handlePick = useCallback(
    (value: string) => {
      if (list === 'top' && (value === SUGGEST || value === MOVE)) {
        // The menu closes on a pick; this one opens the next list instead.
        setList(value === SUGGEST ? 'suggest' : 'move');
        setOpen(true);
        return;
      }
      setOpen(false);
      if (list === 'move') void move(item.id, fromId, value).then(onChange);
      else if (list === 'suggest')
        void act(apiFtdSuggest(item.id, value, !suggested.has(value))).then(
          onChange,
        );
      else if (value === REMOVE) onRemove();
    },
    [list, item.id, fromId, suggested, onChange, onRemove],
  );

  return (
    <>
      <IconButton
        ref={button}
        className='freethedream-checklist__more'
        icon='more_horiz'
        iconComponent={MoreIcon}
        title={intl.formatMessage(messages.menu, { title: item.title })}
        expanded={open}
        disabled={disabled}
        onClick={handleToggle}
      />
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
                key={list}
                items={items}
                value=''
                onClose={handleClose}
                onChange={handlePick}
                classNamePrefix='privacy-dropdown'
              />
            </div>
          </div>
        )}
      </Overlay>
    </>
  );
};

// Who's been suggested for an entry; to whoever it is, a way to say it's
// not for them (taking it on, On it or I'll bring it, ends it too).
const Suggested: React.FC<{
  item: FtdItemRow;
  canAct: boolean;
  onChange: () => void;
}> = ({ item, canAct, onChange }) => {
  const intl = useIntl();
  const me = item.suggested_me;
  const people = item.suggested ?? [];
  const handleNotForMe = useCallback(() => {
    void act(apiFtdSuggest(item.id, null, false)).then(onChange);
  }, [item.id, onChange]);
  if (people.length === 0) return null;

  return (
    <span className='freethedream-checklist__suggested'>
      <span className='freethedream-checklist__suggested-label'>
        {intl.formatMessage(me ? messages.suggestedYou : messages.suggested)}
      </span>
      <PeopleRow people={people} max={3} />
      {me && canAct && (
        <button
          type='button'
          className='freethedream__button freethedream__button--small freethedream__button--quiet'
          onClick={handleNotForMe}
        >
          {intl.formatMessage(messages.notForMe)}
        </button>
      )}
    </span>
  );
};

const Entry: React.FC<{
  item: FtdItemRow;
  canAct: boolean;
  onChange: () => void;
  fromId: string;
  // The other checklists it can move to; none when there are none.
  targets: MoveTarget[];
  // Who it can be suggested to (everyone else in the projekt).
  people: FtdAccount[];
}> = ({ item, canAct, onChange, fromId, targets, people }) => {
  const intl = useIntl();
  const [busy, setBusy] = useState(false);
  const handleRetype = useCallback(
    (kind: QuickAddKind) => {
      setBusy(true);
      void act(apiFtdUpdateItem(item.id, RETYPE[kind])).then(() => {
        setBusy(false);
        onChange();
      });
    },
    [item.id, onChange],
  );
  // Whoever added an entry deletes it from its ⋯ menu (Kommons
  // "Checklist", 2026-11-22: "easily delete checklist items if added by
  // mistake"). One tap, unless someone else already has a hand in it.
  const [confirmRemove, setConfirmRemove] = useState(false);
  const remove = useCallback(() => {
    setConfirmRemove(false);
    setBusy(true);
    void act(apiFtdRemoveItem(item.id)).then(() => {
      setBusy(false);
      onChange();
    });
  }, [item.id, onChange]);
  const handleRemove = useCallback(() => {
    if (othersIn(item)) setConfirmRemove(true);
    else remove();
  }, [item, remove]);
  const cancelRemove = useCallback(() => {
    setConfirmRemove(false);
  }, []);

  const movable = canAct && targets.length > 0;
  const removable = canAct && item.mine;
  const suggestable = canAct && people.length > 0;
  const menu = movable || removable || suggestable;
  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLLIElement>) => {
      e.dataTransfer.setData(
        DRAG_TYPE,
        JSON.stringify({ id: item.id, from: fromId }),
      );
      e.dataTransfer.effectAllowed = 'move';
    },
    [item.id, fromId],
  );

  return (
    <li
      className={classNames('freethedream-checklist__entry', {
        'freethedream-checklist__entry--done': isDone(item),
        'freethedream-checklist__entry--movable': movable,
      })}
      style={
        {
          '--corner-buttons': Number(menu),
        } as React.CSSProperties
      }
      draggable={movable}
      onDragStart={movable ? handleDragStart : undefined}
    >
      {canAct && item.mine ? (
        <KindPick
          kind={kindOf(item)}
          onPick={handleRetype}
          label={messages.changeKind}
          className='freethedream-checklist__kind freethedream-checklist__kind--change'
          disabled={busy}
        />
      ) : (
        <span className='freethedream-checklist__kind'>
          <KindIcon kind={kindOf(item)} />
          {intl.formatMessage(
            item.kind === 'need'
              ? messages.bring
              : TASK_WORDS[taskOf(item)].label,
          )}
        </span>
      )}
      {item.kind === 'need' ? (
        <>
          <span className='freethedream-checklist__title'>{item.title}</span>
          {canAct && <BringControl need={item} onChange={onChange} />}
        </>
      ) : (
        <ToDo item={item} canAct={canAct} onChange={onChange} />
      )}
      <Suggested item={item} canAct={canAct} onChange={onChange} />
      {menu && (
        <span className='freethedream-checklist__corner'>
          <EntryMenu
            item={item}
            fromId={fromId}
            targets={movable ? targets : []}
            people={suggestable ? people : []}
            removable={removable}
            disabled={busy}
            onChange={onChange}
            onRemove={handleRemove}
          />
        </span>
      )}
      {confirmRemove && (
        <ConfirmDialog
          title={intl.formatMessage(messages.removeTitle, {
            title: item.title,
          })}
          message={intl.formatMessage(messages.removeBody)}
          confirmLabel={intl.formatMessage(messages.removeConfirm)}
          destructive
          onConfirm={remove}
          onCancel={cancelRemove}
        />
      )}
    </li>
  );
};

// One checklist's entries and its add line: a Komponent's own, or one of
// its fractals' (Kommons "Fractals", 2026-11-22).
export const ChecklistEntries: React.FC<{
  projectId: string;
  items: FtdItemRow[];
  canAct: boolean;
  onChange: () => void;
  // Every checklist on the page, this one included (`moveTargets`).
  targets?: MoveTarget[];
  // Everyone in the projekt, to suggest for an entry.
  members?: FtdAccount[];
}> = ({ projectId, items, canAct, onChange, targets = [], members = [] }) => {
  const intl = useIntl();
  const [kind, setKind] = useState<QuickAddKind>('job');
  const others = useMemo(
    () => targets.filter((t) => t.id !== projectId),
    [targets, projectId],
  );
  // Suggesting is for someone else: the viewer is left out.
  const people = useMemo(() => members.filter((m) => m.id !== me), [members]);

  // An entry dragged here from another checklist on the page moves here.
  const [over, setOver] = useState(false);
  const droppable = canAct && others.length > 0;
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOver(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null))
      setOver(false);
  }, []);
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      setOver(false);
      const raw = e.dataTransfer.getData(DRAG_TYPE);
      if (!raw) return;
      e.preventDefault();
      const { id, from } = JSON.parse(raw) as { id: string; from: string };
      if (from !== projectId) void move(id, from, projectId).then(onChange);
    },
    [projectId, onChange],
  );

  const entries = items
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
    <div
      className={classNames('freethedream-checklist__drop', {
        'freethedream-checklist__drop--over': over,
      })}
      onDragOver={droppable ? handleDragOver : undefined}
      onDragLeave={droppable ? handleDragLeave : undefined}
      onDrop={droppable ? handleDrop : undefined}
      data-drop-label={over ? intl.formatMessage(messages.dropHere) : undefined}
    >
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
              fromId={projectId}
              targets={others}
              people={people}
            />
          ))}
        </ul>
      )}
      {canAct && (
        <div className='freethedream-checklist__add'>
          <QuickAdd
            kind={kind}
            projectId={projectId}
            onAdded={onChange}
            pick={
              <KindPick
                kind={kind}
                onPick={setKind}
                label={messages.addKind}
                className='freethedream-checklist__pick'
              />
            }
          />
        </div>
      )}
    </div>
  );
};

export const Checklist: React.FC<{
  project: FtdProject;
  onChange: () => void;
}> = ({ project, onChange }) => {
  const intl = useIntl();

  return (
    <Section title={intl.formatMessage(messages.title)}>
      <ChecklistEntries
        projectId={project.id}
        items={project.items}
        canAct={project.can.add}
        onChange={onChange}
        targets={moveTargets(project)}
        members={project.members}
      />
    </Section>
  );
};
