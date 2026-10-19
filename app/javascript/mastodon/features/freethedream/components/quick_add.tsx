import { useCallback, useMemo, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiFtdCreateItem } from 'mastodon/api/freethedream';
import type { FtdItemKind } from 'mastodon/api_types/freethedream';

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

const messages = defineMessages({
  need: {
    id: 'freethedream.quick.need',
    defaultMessage: 'Add what’s needed: gas bottle, plates',
  },
  howMany: { id: 'freethedream.quick.how_many', defaultMessage: 'How many' },
  job: {
    id: 'freethedream.quick.actualise',
    defaultMessage: 'An idea to bring to life: a spit roast, a fire twirler',
  },
  add: { id: 'freethedream.quick.add', defaultMessage: 'Add' },
  added: { id: 'freethedream.quick.added', defaultMessage: 'Added {what}' },
  addedOn: {
    id: 'freethedream.quick.added_on',
    defaultMessage: 'Added {what}. You’re on it.',
  },
});

interface Props {
  kind: Extract<FtdItemKind, 'need' | 'job'>;
  projectId: string;
  onAdded: () => void;
}

export const QuickAdd: React.FC<Props> = ({ kind, projectId, onAdded }) => {
  const intl = useIntl();
  const [text, setText] = useState('');
  const [count, setCount] = useState('');
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // With a number in the box, the line is read as if it led with it, so
  // "kg rice" and 5 is 5 kg of rice.
  const boxed = kind === 'need' && Number.parseInt(count, 10) > 0;
  const parsed = useMemo(
    () =>
      kind === 'job'
        ? null
        : boxed
          ? { ...parseLine(`${count} ${text.trim()}`), more }
          : parseLine(text),
    [kind, boxed, count, text, more],
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    setNote(null);
  }, []);

  const handleCount = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCount(e.target.value.replace(/\D/g, '').slice(0, 6));
    setNote(null);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!text.trim() || busy) return;
      const line =
        kind === 'job'
          ? { quantity: 1, unit: '', title: text.trim(), more: false }
          : parsed;
      if (!line?.title) return;
      setBusy(true);
      setError(null);
      apiFtdCreateItem({
        project_id: projectId,
        kind,
        title: line.title,
        quantity: line.quantity,
        unit: kind === 'need' ? line.unit : '',
        more_welcome: kind === 'need' && line.more,
        category: line.unit === '$' ? 'money' : null,
      })
        .then(() => {
          setText('');
          setCount('');
          setMore(false);
          setBusy(false);
          setNote(
            kind === 'need'
              ? intl.formatMessage(messages.added, {
                  what:
                    line.quantity > 1 || line.unit
                      ? `${line.title} (${formatNeed(line.quantity, line.unit, line.more)})`
                      : line.title,
                })
              : intl.formatMessage(messages.addedOn, { what: line.title }),
          );
          onAdded();
          input.current?.focus();
        })
        .catch((err: unknown) => {
          setError(errorOf(err));
          setBusy(false);
        });
    },
    [text, parsed, busy, kind, projectId, onAdded, intl],
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
      {kind === 'need' && (
        <input
          className='freethedream__input freethedream-quick__count'
          type='text'
          inputMode='numeric'
          value={count}
          onChange={handleCount}
          placeholder={intl.formatMessage(messages.howMany)}
          aria-label={intl.formatMessage(messages.howMany)}
        />
      )}
      {/* Once there's an amount: is more welcome? (Tal, 2026-10-19) */}
      {counted && <MoreWelcome on={parsed.more} onToggle={handleMore} />}
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
