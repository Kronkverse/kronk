import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { apiAnswerKuestion } from 'mastodon/api/kuestions';
import type { ApiKuestionJSON } from 'mastodon/api_types/kuestions';

const messages = defineMessages({
  cancel: { id: 'kuestions.sheet.cancel', defaultMessage: 'Back to deck' },
  send: {
    id: 'kuestions.sheet.send',
    defaultMessage: 'Answer & unlock',
  },
  placeholder: {
    id: 'kuestions.sheet.placeholder',
    defaultMessage: "Your answer unlocks everyone else's.",
  },
  mcHint: {
    id: 'kuestions.sheet.mc_hint',
    defaultMessage: 'Tap your pick — that submits and unlocks.',
  },
  askedBy: {
    id: 'kuestions.sheet.asked_by',
    defaultMessage:
      'asked by {asker} · {count, plural, one {# locked answer} other {# locked answers}}',
  },
});

interface AnswerSheetProps {
  kuestion: ApiKuestionJSON;
  onCancel: () => void;
  onSubmitted: (updated: ApiKuestionJSON) => void;
}

// Bottom-sheet modal used by the Yours panel's "Answer your own"
// flow. Format-aware:
//   - `text` → textarea + explicit send.
//   - `mc` / `yn` → tap-to-choose chips that submit on pick.
// Answer visibility inherits from the kuestion — the answer is
// visible to everyone the kuestion is visible to, gated only by
// Kuestions::VisibilityGate's answer-before-view rule. No per-
// answer scope picker here or on the deck card (Tal 2026-09-09).
export const AnswerSheet: React.FC<AnswerSheetProps> = ({
  kuestion,
  onCancel,
  onSubmitted,
}) => {
  const intl = useIntl();
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (kuestion.answer_format === 'text') {
      const t = setTimeout(() => textRef.current?.focus(), 200);
      return () => {
        clearTimeout(t);
      };
    }
    return undefined;
  }, [kuestion.answer_format]);

  const submit = useCallback(
    (params: { body?: string; choice_index?: number }) => {
      if (pending) return;
      setPending(true);
      setError(null);
      void (async () => {
        try {
          const updated = await apiAnswerKuestion(kuestion.id, params);
          onSubmitted(updated);
        } catch {
          setError('answer_failed');
          setPending(false);
        }
      })();
    },
    [kuestion.id, onSubmitted, pending],
  );

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
    },
    [],
  );

  const handleSend = useCallback(() => {
    const body = text.trim();
    if (!body) return;
    submit({ body });
  }, [submit, text]);

  const handleChoice = useCallback(
    (idx: number) => {
      submit({ choice_index: idx });
    },
    [submit],
  );

  const askerName = kuestion.asker.display_name || kuestion.asker.username;
  const canSend =
    kuestion.answer_format === 'text' && text.trim() !== '' && !pending;

  return (
    <div className='kuestions-sheet-wrap' role='dialog' aria-modal>
      <button
        type='button'
        className='kuestions-sheet-backdrop'
        aria-label={intl.formatMessage(messages.cancel)}
        onClick={onCancel}
      />
      <div className='kuestions-sheet'>
        <div className='kuestions-sheet__grab' aria-hidden />
        <h2 className='kuestions-sheet__q'>{kuestion.title}</h2>
        <p className='kuestions-sheet__by'>
          {intl.formatMessage(messages.askedBy, {
            asker: askerName,
            count: kuestion.answers_count,
          })}
        </p>

        {kuestion.answer_format === 'text' && (
          <textarea
            ref={textRef}
            className='kuestions-sheet__text'
            value={text}
            onChange={handleTextChange}
            placeholder={intl.formatMessage(messages.placeholder)}
            disabled={pending}
          />
        )}

        {(kuestion.answer_format === 'mc' ||
          kuestion.answer_format === 'yn') && (
          <>
            <p className='kuestions-sheet__hint'>
              {intl.formatMessage(messages.mcHint)}
            </p>
            <ChoiceGrid
              options={kuestion.mc_options.map((o) => o.label)}
              layout={kuestion.answer_format}
              disabled={pending}
              onPick={handleChoice}
            />
          </>
        )}

        {error && (
          <p className='kuestions-sheet__error' role='alert'>
            <FormattedMessage
              id='kuestions.sheet.error'
              defaultMessage="Couldn't send. Try again."
            />
          </p>
        )}

        {kuestion.answer_format === 'text' && (
          <div className='kuestions-sheet__actions'>
            <button
              type='button'
              className='kuestions-btn kuestions-btn--ghost'
              onClick={onCancel}
              disabled={pending}
            >
              {intl.formatMessage(messages.cancel)}
            </button>
            <button
              type='button'
              className='kuestions-btn'
              onClick={handleSend}
              disabled={!canSend}
            >
              {intl.formatMessage(messages.send)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

interface ChoiceGridProps {
  options: string[];
  layout: 'mc' | 'yn';
  disabled: boolean;
  onPick: (idx: number) => void;
}

const ChoiceGrid: React.FC<ChoiceGridProps> = ({
  options,
  layout,
  disabled,
  onPick,
}) => (
  <div
    className={`kuestions-sheet__choices kuestions-sheet__choices--${layout}`}
  >
    {options.map((label, idx) => (
      <ChoiceButton
        key={label}
        label={label}
        idx={idx}
        disabled={disabled}
        layout={layout}
        onPick={onPick}
      />
    ))}
  </div>
);

interface ChoiceButtonProps {
  label: string;
  idx: number;
  disabled: boolean;
  layout: 'mc' | 'yn';
  onPick: (idx: number) => void;
}

const ChoiceButton: React.FC<ChoiceButtonProps> = ({
  label,
  idx,
  disabled,
  layout,
  onPick,
}) => {
  const handleClick = useCallback(() => {
    onPick(idx);
  }, [onPick, idx]);
  const isYn = layout === 'yn';
  const yesish = isYn && idx === 0;
  return (
    <button
      type='button'
      className={`kuestions-sheet__choice ${
        isYn
          ? yesish
            ? 'kuestions-sheet__choice--yes'
            : 'kuestions-sheet__choice--no'
          : ''
      }`}
      onClick={handleClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
};
