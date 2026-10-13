import { useCallback, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiFtdCreateItem } from 'mastodon/api/freethedream';
import type { FtdItemKind } from 'mastodon/api_types/freethedream';

import { errorOf, formatAmount, parseLine } from './shared';

// One line, Enter, done: "30 plates", "5 kg rice", "$400 permits",
// "2 set-up crew". The box stays open and focused for the next one, so a
// whole kit list goes in one after another without a form each time.

const messages = defineMessages({
  need: {
    id: 'freethedream.quick.need',
    defaultMessage: 'Add what’s needed: 30 plates, 5 kg rice, 4 tarps',
  },
  job: {
    id: 'freethedream.quick.job',
    defaultMessage: 'Add a job: 2 set-up crew, build the fire frame',
  },
  idea: {
    id: 'freethedream.quick.idea',
    defaultMessage: 'Suggest something: dahl for 40, a spit roast',
  },
  add: { id: 'freethedream.quick.add', defaultMessage: 'Add' },
  people: {
    id: 'freethedream.quick.people',
    defaultMessage: '{count, plural, one {# person} other {# people}}',
  },
  added: { id: 'freethedream.quick.added', defaultMessage: 'Added {what}' },
});

interface Props {
  kind: Extract<FtdItemKind, 'need' | 'job' | 'idea'>;
  projectId: string;
  onAdded: () => void;
}

export const QuickAdd: React.FC<Props> = ({ kind, projectId, onAdded }) => {
  const intl = useIntl();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const parsed = kind === 'idea' ? null : parseLine(text);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    setNote(null);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!text.trim() || busy) return;
      const line =
        kind === 'idea'
          ? { quantity: 1, unit: '', title: text.trim() }
          : parseLine(text);
      if (!line.title) return;
      setBusy(true);
      setError(null);
      apiFtdCreateItem({
        project_id: projectId,
        kind,
        title: line.title,
        quantity: line.quantity,
        unit: kind === 'need' ? line.unit : '',
        category: line.unit === '$' ? 'money' : null,
      })
        .then(() => {
          setText('');
          setBusy(false);
          setNote(
            intl.formatMessage(messages.added, {
              what:
                kind === 'need'
                  ? `${formatAmount(line.quantity, line.unit)} ${line.title}`
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
    [text, busy, kind, projectId, onAdded, intl],
  );

  const hint =
    parsed && text.trim() !== '' && (parsed.quantity > 1 || parsed.unit)
      ? kind === 'job'
        ? `${parsed.title} · ${intl.formatMessage(messages.people, { count: parsed.quantity })}`
        : `${parsed.title} · ${formatAmount(parsed.quantity, parsed.unit)}`
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
