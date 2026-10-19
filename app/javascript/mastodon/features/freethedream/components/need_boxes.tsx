import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { MoreWelcome, formatNeed, parseLine, togglePlus } from './shared';

// What a new gang or fractal needs, one thing to a box, the way things go
// into Thing Bringing (Tal, 2026-10-17: not one big text box). There's
// always an empty box at the end; Enter in a box goes to the next, and an
// amount shows beside its box: "2 gas bottles" as 2, "20+ plates" as 20+,
// with a More welcome toggle that puts the + in or takes it out (Tal,
// 2026-10-19).

const messages = defineMessages({
  remove: {
    id: 'freethedream.compose.need_remove',
    defaultMessage: 'Take {what} off',
  },
  thing: {
    id: 'freethedream.compose.need_box',
    defaultMessage: 'Something it needs',
  },
});

// Example things for the first empty boxes.
const EXAMPLES = ['Power', '2 gas bottles', '200 L water', '20+ cups'];

interface Props {
  lines: string[];
  onChange: (lines: string[]) => void;
}

export const NeedBoxes: React.FC<Props> = ({ lines, onChange }) => {
  const intl = useIntl();
  const list = useRef<HTMLUListElement>(null);
  const [focusOn, setFocusOn] = useState<number | null>(null);
  // Every line typed so far, then one empty box for the next.
  const shown = [...lines, ''];

  useEffect(() => {
    if (focusOn === null) return;
    list.current?.querySelectorAll('input')[focusOn]?.focus();
    setFocusOn(null);
  }, [focusOn]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const i = Number(e.target.dataset.index);
      const next = [...lines];
      next[i] = e.target.value;
      onChange(next);
    },
    [lines, onChange],
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
      if (i < lines.length && !e.target.value.trim())
        onChange(lines.filter((_, j) => j !== i));
    },
    [lines, onChange],
  );

  const handleMore = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const i = Number(e.currentTarget.dataset.index);
      const next = [...lines];
      next[i] = togglePlus(next[i] ?? '');
      onChange(next);
    },
    [lines, onChange],
  );

  const handleRemove = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const i = Number(e.currentTarget.dataset.index);
      onChange(lines.filter((_, j) => j !== i));
    },
    [lines, onChange],
  );

  return (
    <ul className='freethedream-boxes' ref={list}>
      {shown.map((line, i) => {
        const parsed = parseLine(line);
        const filled = line.trim() !== '';
        return (
          // Boxes have no ids of their own; position is who they are.
          <li key={i} className='freethedream-boxes__row'>
            <input
              className='freethedream__input freethedream-boxes__input'
              type='text'
              value={line}
              data-index={i}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              placeholder={EXAMPLES[i] ?? ''}
              aria-label={intl.formatMessage(messages.thing)}
              enterKeyHint='next'
            />
            {filled && (parsed.quantity > 1 || parsed.unit) && (
              <>
                <span className='freethedream-boxes__amount'>
                  {formatNeed(parsed.quantity, parsed.unit, parsed.more)}
                </span>
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
                  what: line.trim(),
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
