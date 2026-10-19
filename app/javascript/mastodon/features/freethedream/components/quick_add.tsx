import { useCallback, useRef, useState } from 'react';

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

// One line, Enter, done: "30 plates", "5 kg rice", "$400 permits" in
// Thing Bringing, "a fire twirler at sunset" in Actualise. The box stays
// open and focused for the next one, so a whole kit list goes in one after
// another without a form each time. What goes into Actualise is taken as
// written (no amount), and whoever adds it is on it.

const messages = defineMessages({
  need: {
    id: 'freethedream.quick.need',
    defaultMessage: 'Add what’s needed: 2 gas bottles, 20+ plates',
  },
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
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const parsed = kind === 'job' ? null : parseLine(text);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    setNote(null);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!text.trim() || busy) return;
      const line =
        kind === 'job'
          ? { quantity: 1, unit: '', title: text.trim(), more: false }
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
        more_welcome: kind === 'need' && line.more,
        category: line.unit === '$' ? 'money' : null,
      })
        .then(() => {
          setText('');
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
    [text, busy, kind, projectId, onAdded, intl],
  );

  const counted =
    !!parsed && text.trim() !== '' && (parsed.quantity > 1 || !!parsed.unit);
  const handleMore = useCallback(() => {
    setText((t) => togglePlus(t));
    input.current?.focus();
  }, []);

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
