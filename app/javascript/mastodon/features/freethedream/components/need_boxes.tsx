import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { MoreWelcome, formatNeed, parseLine, togglePlus } from './shared';

// What a new gang or fractal needs, one thing to a box, the way things go
// into Thing Bringing (Tal, 2026-10-17: not one big text box). There's
// always an empty box at the end; Enter in a box goes to the next, and an
// amount shows beside its box: "2 gas bottles" as 2, "20+ plates" as 20+,
// with a More welcome toggle that puts the + in or takes it out (Tal,
// 2026-10-19). Each box has a How many box beside it, as Thing Bringing's
// add line does (Tal, 2026-10-19); when it's filled it wins over a number
// typed into the box, and the line handed up is "20+ plates" either way.

const messages = defineMessages({
  remove: {
    id: 'freethedream.compose.need_remove',
    defaultMessage: 'Take {what} off',
  },
  thing: {
    id: 'freethedream.compose.need_box',
    defaultMessage: 'Something it needs',
  },
  howMany: {
    id: 'freethedream.compose.need_how_many',
    defaultMessage: 'How many of {what}',
  },
  howManyShort: {
    id: 'freethedream.quick.how_many',
    defaultMessage: 'How many',
  },
});

// Example things for the first empty boxes.
const EXAMPLES = ['Power', 'Gas bottles', 'L water', 'Cups'];

// One box as it's being typed: the words, and the How many beside them.
interface Row {
  text: string;
  count: string;
  more: boolean;
}

const toRow = (line: string): Row => ({ text: line, count: '', more: false });

const hasCount = (row: Row) => Number.parseInt(row.count, 10) > 0;

// The line a row says: the box's number leads it when there is one.
const toLine = (row: Row) =>
  hasCount(row)
    ? `${row.count}${row.more ? '+' : ''} ${row.text.trim()}`
    : row.text;

const isEmpty = (row: Row) => !row.text.trim() && !hasCount(row);

interface Props {
  lines: string[];
  onChange: (lines: string[]) => void;
}

export const NeedBoxes: React.FC<Props> = ({ lines, onChange }) => {
  const intl = useIntl();
  const list = useRef<HTMLUListElement>(null);
  const [focusOn, setFocusOn] = useState<number | null>(null);
  const [rows, setRows] = useState<Row[]>(() => lines.map(toRow));
  // What was last handed up, so lines coming down that differ (a draft
  // brought back) replace the rows.
  const sent = useRef(lines);
  if (sent.current !== lines) {
    sent.current = lines;
    setRows(lines.map(toRow));
  }
  // Every row typed so far, then one empty box for the next.
  const shown = useMemo(() => [...rows, toRow('')], [rows]);

  // `keep` is a row being typed in, kept even while it's empty.
  const update = useCallback(
    (next: Row[], keep?: number) => {
      // Only rows with words are things; a number alone waits for them.
      const out = next.filter((row) => row.text.trim()).map(toLine);
      sent.current = out;
      setRows(next.filter((row, j) => j === keep || !isEmpty(row)));
      onChange(out);
    },
    [onChange],
  );

  useEffect(() => {
    if (focusOn === null) return;
    const boxes = list.current?.querySelectorAll<HTMLInputElement>(
      'input[data-role="thing"]',
    );
    boxes?.[focusOn]?.focus();
    setFocusOn(null);
  }, [focusOn]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const i = Number(e.target.dataset.index);
      const next = [...shown];
      next[i] = { ...(next[i] ?? toRow('')), text: e.target.value };
      update(next, i);
    },
    [shown, update],
  );

  const handleCount = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const i = Number(e.target.dataset.index);
      const next = [...shown];
      next[i] = {
        ...(next[i] ?? toRow('')),
        count: e.target.value.replace(/\D/g, '').slice(0, 6),
      };
      update(next, i);
    },
    [shown, update],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter') return;
      // Enter is the next box, not sending the form.
      e.preventDefault();
      const i = Number(e.currentTarget.dataset.index);
      if (e.currentTarget.value.trim()) setFocusOn(i + 1);
    },
    [],
  );

  // An emptied box goes when you leave it, so the list stays tidy.
  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const i = Number(e.target.dataset.index);
      const row = rows[i];
      if (row && isEmpty(row)) update(rows.filter((_, j) => j !== i));
    },
    [rows, update],
  );

  const handleMore = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const i = Number(e.currentTarget.dataset.index);
      const row = rows[i];
      if (!row) return;
      const next = [...rows];
      // The + goes with the number: the How many box's, else the words'.
      next[i] = hasCount(row)
        ? { ...row, more: !row.more }
        : { ...row, text: togglePlus(row.text) };
      update(next);
    },
    [rows, update],
  );

  const handleRemove = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const i = Number(e.currentTarget.dataset.index);
      update(rows.filter((_, j) => j !== i));
    },
    [rows, update],
  );

  return (
    <ul className='freethedream-boxes' ref={list}>
      {shown.map((row, i) => {
        const line = toLine(row);
        const parsed = parseLine(line);
        const filled = line.trim() !== '';
        return (
          // Boxes have no ids of their own; position is who they are.
          <li key={i} className='freethedream-boxes__row'>
            <input
              className='freethedream__input freethedream-boxes__input'
              type='text'
              value={row.text}
              data-index={i}
              data-role='thing'
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              placeholder={EXAMPLES[i] ?? ''}
              aria-label={intl.formatMessage(messages.thing)}
              enterKeyHint='next'
            />
            <input
              className='freethedream__input freethedream-boxes__count'
              type='text'
              inputMode='numeric'
              value={row.count}
              data-index={i}
              onChange={handleCount}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              placeholder={intl.formatMessage(messages.howManyShort)}
              aria-label={intl.formatMessage(messages.howMany, {
                what: row.text.trim() || intl.formatMessage(messages.thing),
              })}
              enterKeyHint='next'
            />
            {filled && (parsed.quantity > 1 || parsed.unit) && (
              <>
                {/* The amount read back, when it says more than the box. */}
                {(!hasCount(row) || parsed.unit) && (
                  <span className='freethedream-boxes__amount'>
                    {formatNeed(parsed.quantity, parsed.unit, parsed.more)}
                  </span>
                )}
                <MoreWelcome on={parsed.more} onToggle={handleMore} index={i} />
              </>
            )}
            {filled && (
              <button
                type='button'
                className='freethedream-boxes__remove'
                data-index={i}
                onClick={handleRemove}
                aria-label={intl.formatMessage(messages.remove, {
                  what: parsed.title || line.trim(),
                })}
              >
                ×
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
};
