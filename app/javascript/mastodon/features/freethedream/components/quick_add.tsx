import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiFtdCreateItem } from 'mastodon/api/freethedream';
import type { FtdCategory, FtdTask } from 'mastodon/api_types/freethedream';

import {
  MoreWelcome,
  errorOf,
  formatNeed,
  parseLine,
  togglePlus,
} from './shared';

// One line, Enter, done: "plates" with 30 in the How many box (or "30
// plates" typed straight in), "5 kg rice", "$400 permits" in Thing Bringing, "a fire twirler at sunset" in Actualise. The box stays
// open and focused for the next one, so a whole kit list goes in one after
// another without a form each time. What goes into Actualise is taken as
// written (no amount), and whoever adds it is on it. The How many box sits
// beside the line so it's plain a need can have a number (Tal, 2026-10-19);
// when it's filled it wins over a number typed into the line.
//
// On a Komponent's checklist, Pay and Book are To dos of their own kind
// (decisions.md, 2026-11-11). Pay takes an amount the same way, in dollars:
// "$200 hall deposit", or 200 in the How much box. A Decide is a quick
// Kuestion: its choices go in the Choices box, "Sat, Sun", or none for Yes
// or No.

const messages = defineMessages({
  need: {
    id: 'freethedream.quick.need',
    defaultMessage: "Add what's needed",
  },
  howMany: { id: 'freethedream.quick.how_many', defaultMessage: 'How many' },
  howMuch: { id: 'freethedream.quick.how_much', defaultMessage: 'Amount' },
  job: {
    id: 'freethedream.quick.todo',
    defaultMessage: 'Add something to do',
  },
  pay: {
    id: 'freethedream.quick.pay',
    defaultMessage: 'Add something to pay for',
  },
  book: {
    id: 'freethedream.quick.book',
    defaultMessage: 'Add something to book',
  },
  decide: {
    id: 'freethedream.quick.decide',
    defaultMessage: 'Add something to decide',
  },
  choices: {
    id: 'freethedream.quick.choices',
    defaultMessage: 'Choices, or none for yes or no',
  },
  choicesCount: {
    id: 'freethedream.quick.choices_count',
    defaultMessage: 'Give two to four choices, or none for yes or no.',
  },
  add: { id: 'freethedream.quick.add', defaultMessage: 'Add' },
  added: { id: 'freethedream.quick.added', defaultMessage: 'Added {what}' },
});

// What's being added: a need, or a To do of one of its kinds.
export type QuickAddKind = 'need' | 'job' | Exclude<FtdTask, 'todo'>;

interface Props {
  kind: QuickAddKind;
  projectId: string;
  onAdded: () => void;
  // On the right of the box: on a checklist, the kind being added.
  pick?: React.ReactNode;
}

interface Line {
  quantity: number;
  unit: string;
  title: string;
  more: boolean;
}

export const QuickAdd: React.FC<Props> = ({
  kind,
  projectId,
  onAdded,
  pick,
}) => {
  const intl = useIntl();
  const [text, setText] = useState('');
  const [count, setCount] = useState('');
  const [choices, setChoices] = useState('');
  const [more, setMore] = useState(false);
  // No category pills under the box any more (Tal, 2026-11-08): a need is
  // Things and an idea is Skills, which the Mycelium still matches on.
  const category: FtdCategory =
    kind === 'need' ? 'things' : kind === 'pay' ? 'money' : 'skills';
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // Changing the kind keeps what's typed (Tal, 2026-11-11: "the text i've
  // typed gets removed"), but not a count, which is how many for Bring and
  // how much for Pay.
  useEffect(() => {
    setCount('');
    setNote(null);
    setError(null);
  }, [kind]);

  const counts = kind === 'need' || kind === 'pay';
  // With a number in the box, the line is read as if it led with it, so
  // "kg rice" and 5 is 5 kg of rice.
  const boxed = counts && Number.parseInt(count, 10) > 0;
  const parsed = useMemo<Line | null>(() => {
    if (kind === 'need')
      return boxed
        ? { ...parseLine(`${count} ${text.trim()}`), more }
        : parseLine(text);
    if (kind === 'pay') {
      if (boxed)
        return {
          quantity: Number.parseInt(count, 10),
          unit: '$',
          title: text.trim(),
          more: false,
        };
      // Only a dollar amount is an amount here; anything else is the title.
      const line = parseLine(text);
      return line.unit === '$' && line.title
        ? { ...line, more: false }
        : { quantity: 1, unit: '', title: text.trim(), more: false };
    }
    return null;
  }, [kind, boxed, count, text, more]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    setNote(null);
  }, []);

  const handleCount = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCount(e.target.value.replace(/\D/g, '').slice(0, 6));
    setNote(null);
  }, []);

  const handleChoices = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setChoices(e.target.value);
      setError(null);
    },
    [],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!text.trim() || busy) return;
      const options =
        kind === 'decide'
          ? choices
              .split(',')
              .map((c) => c.trim())
              .filter(Boolean)
          : [];
      if (options.length === 1 || options.length > 4) {
        setError(intl.formatMessage(messages.choicesCount));
        return;
      }
      const line: Line | null = parsed ?? {
        quantity: 1,
        unit: '',
        title: text.trim(),
        more: false,
      };
      if (!line.title) return;
      setBusy(true);
      setError(null);
      apiFtdCreateItem({
        project_id: projectId,
        kind: kind === 'need' ? 'need' : 'job',
        task: kind === 'need' || kind === 'job' ? undefined : kind,
        options: options.length > 0 ? options : undefined,
        title: line.title,
        quantity: line.quantity,
        unit: counts ? line.unit : '',
        more_welcome: kind === 'need' && line.more,
        category: line.unit === '$' ? 'money' : category,
      })
        .then(() => {
          setText('');
          setCount('');
          setChoices('');
          setMore(false);
          setBusy(false);
          setNote(
            intl.formatMessage(messages.added, {
              what:
                counts && (line.quantity > 1 || line.unit)
                  ? `${line.title} (${formatNeed(line.quantity, line.unit, line.more)})`
                  : line.title,
            }),
          );
          onAdded();
          input.current?.focus();
        })
        .catch((err: unknown) => {
          setError(errorOf(err));
          setBusy(false);
        });
    },
    [
      text,
      choices,
      parsed,
      busy,
      kind,
      counts,
      projectId,
      onAdded,
      intl,
      category,
    ],
  );

  const counted =
    !!parsed && text.trim() !== '' && (parsed.quantity > 1 || !!parsed.unit);
  // The + goes with the number: in the box when it's there, else in the line.
  const handleMore = useCallback(() => {
    if (boxed) setMore((m) => !m);
    else setText((t) => togglePlus(t));
  }, [boxed]);

  const hint =
    parsed && counted
      ? `${parsed.title} · ${formatNeed(parsed.quantity, parsed.unit, parsed.more)}`
      : null;

  return (
    <form className='freethedream-quick' onSubmit={handleSubmit}>
      <input
        ref={input}
        className='freethedream__input'
        value={text}
        onChange={handleChange}
        placeholder={intl.formatMessage(messages[kind])}
        aria-label={intl.formatMessage(messages[kind])}
        maxLength={180}
      />
      {pick}
      {counts && (
        <input
          className='freethedream__input freethedream-quick__count'
          type='text'
          inputMode='numeric'
          value={count}
          onChange={handleCount}
          placeholder={intl.formatMessage(
            kind === 'pay' ? messages.howMuch : messages.howMany,
          )}
          aria-label={intl.formatMessage(
            kind === 'pay' ? messages.howMuch : messages.howMany,
          )}
        />
      )}
      {kind === 'decide' && (
        <input
          className='freethedream__input freethedream-quick__choices'
          value={choices}
          onChange={handleChoices}
          placeholder={intl.formatMessage(messages.choices)}
          aria-label={intl.formatMessage(messages.choices)}
          maxLength={240}
        />
      )}
      {/* Once there's an amount: is more welcome? (Tal, 2026-10-19) */}
      {kind === 'need' && counted && (
        <MoreWelcome on={parsed.more} onToggle={handleMore} />
      )}
      <button
        type='submit'
        className='freethedream__button freethedream__button--small'
        disabled={busy || !text.trim()}
      >
        {intl.formatMessage(messages.add)}
      </button>
      {hint && <span className='freethedream-quick__hint'>{hint}</span>}
      {note && !hint && (
        <span className='freethedream-quick__hint' role='status'>
          {note}
        </span>
      )}
      {error && (
        <p className='freethedream__error' role='alert'>
          {error}
        </p>
      )}
    </form>
  );
};
