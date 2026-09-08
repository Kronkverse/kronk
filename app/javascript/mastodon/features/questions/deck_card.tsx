import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { apiAnswerKuestion } from 'mastodon/api/kuestions';
import type {
  ApiKuestionJSON,
  KuestionVisibilityScope,
} from 'mastodon/api_types/kuestions';
import { Avatar } from 'mastodon/components/avatar';
import { createAccountFromServerJSON } from 'mastodon/models/account';

import { KuestionScopePicker } from './kuestion_scope_picker';

const messages = defineMessages({
  formatText: {
    id: 'kuestions.format.text',
    defaultMessage: 'Free text',
  },
  formatMc: {
    id: 'kuestions.format.mc',
    defaultMessage: 'Multiple choice',
  },
  formatYn: {
    id: 'kuestions.format.yn',
    defaultMessage: 'Yes / No',
  },
  skipStamp: { id: 'kuestions.stamp.skip', defaultMessage: 'Skip' },
  tapToAnswer: {
    id: 'kuestions.stamp.tap_to_answer',
    defaultMessage: 'Tap to answer, swipe left to skip',
  },
  lockedCount: {
    id: 'kuestions.deck.count',
    defaultMessage:
      '{count, plural, =0 {No answers · locked} one {# answer · locked} other {# answers · locked}}',
  },
  placeholder: {
    id: 'kuestions.card.placeholder',
    defaultMessage: "Your answer unlocks everyone else's.",
  },
  cancel: { id: 'kuestions.card.cancel', defaultMessage: 'Cancel' },
  send: { id: 'kuestions.card.send', defaultMessage: 'Answer & unlock' },
  sending: { id: 'kuestions.card.sending', defaultMessage: 'Sending…' },
  sendError: {
    id: 'kuestions.card.send_error',
    defaultMessage: "Couldn't send. Try again.",
  },
  choiceHint: {
    id: 'kuestions.card.choice_hint',
    defaultMessage: 'Tap your pick — that submits and unlocks.',
  },
});

const FORMAT_LABEL = {
  text: messages.formatText,
  mc: messages.formatMc,
  yn: messages.formatYn,
} as const;

// Interaction thresholds:
//   dx < -SKIP_THRESHOLD  → left-swipe skip
//   |dx| < TAP_THRESHOLD  → treat as a tap → start answering
//   anything in between   → snap back (no action)
// Right-swipe was retired: tapping is faster and matches the
// "just start typing" invariant.
const SKIP_THRESHOLD = 95;
const TAP_THRESHOLD = 8;

interface DeckCardProps {
  kuestion: ApiKuestionJSON;
  depth: number; // 0 = top card (interactive), 1..N = stacked behind
  answering: boolean; // parent-controlled — swaps the bottom row for an inline answer form
  onSkip: () => void;
  onAnswer: () => void; // parent opens whatever answer surface fits (inline for text, sheet for mc/yn)
  onAnswered: (updated: ApiKuestionJSON) => void; // called after inline text submit succeeds
  onCancel: () => void; // close the inline answer form without submitting
}

// A single Kuestion card. Only the depth-0 card is interactive.
// When `answering` is true (parent decision), the bottom "locked"
// row swaps to an inline answer form — textarea + scope picker +
// send button — instead of opening a bottom-sheet overlay. Keeps
// the submit button on-screen on phone widths where the sheet
// used to fall off the bottom (Tal 2026-09-08 screenshot).
export const DeckCard: React.FC<DeckCardProps> = ({
  kuestion,
  depth,
  answering,
  onSkip,
  onAnswer,
  onAnswered,
  onCancel,
}) => {
  const intl = useIntl();
  const cardRef = useRef<HTMLDivElement>(null);
  const skipStampRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const [text, setText] = useState('');
  const [scope, setScope] = useState<KuestionVisibilityScope>('mates');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  // Focus the textarea shortly after the form opens (small delay so
  // the layout settles first; matches the old sheet's timing).
  useEffect(() => {
    if (!answering) return undefined;
    const t = setTimeout(() => textRef.current?.focus(), 100);
    return () => {
      clearTimeout(t);
    };
  }, [answering]);

  useEffect(() => {
    // Non-top cards don't listen. The layout transform is set on the
    // ref rather than a style prop so the drag handlers can mutate it
    // without conflict; re-set here if the depth changes on refresh.
    const el = cardRef.current;
    if (!el) return;
    if (depth > 0) {
      el.style.transform = `translateY(${depth * 10}px) scale(${1 - depth * 0.035})`;
      el.style.opacity = depth > 1 ? '0.5' : '1';
      el.style.zIndex = String(10 - depth);
      return;
    }
    el.style.transform = 'translateY(0) scale(1)';
    el.style.opacity = '1';
    el.style.zIndex = '10';
  }, [depth]);

  useEffect(() => {
    if (depth !== 0) return undefined;
    // Suspend the drag handlers while the inline answer form is open
    // — typing in the textarea shouldn't drag the card, and the
    // card doesn't need swipe-to-skip once the form is showing.
    if (answering) return undefined;
    const el = cardRef.current;
    if (!el) return undefined;
    const sS = skipStampRef.current;

    let sx = 0;
    let dx = 0;
    let down = false;

    const start = (e: MouseEvent | TouchEvent) => {
      down = true;
      el.style.transition = 'none';
      const p = 'touches' in e ? e.touches[0] : e;
      if (!p) return;
      sx = p.clientX;
    };
    const move = (e: MouseEvent | TouchEvent) => {
      if (!down) return;
      const p = 'touches' in e ? e.touches[0] : e;
      if (!p) return;
      dx = p.clientX - sx;
      el.style.transform = `translate(${dx}px, ${Math.abs(dx) * 0.06}px) rotate(${dx * 0.045}deg)`;
      if (sS) sS.style.opacity = String(Math.min(1, Math.max(0, -dx / 90)));
      if (e.cancelable) e.preventDefault();
    };
    const end = () => {
      if (!down) return;
      down = false;
      el.style.transition = '';
      if (dx < -SKIP_THRESHOLD) {
        el.classList.add('kuestions-deck__card--gone');
        el.style.transform = `translate(${-window.innerWidth}px,-40px) rotate(-22deg)`;
        onSkip();
      } else if (Math.abs(dx) < TAP_THRESHOLD) {
        // Tap / click — no meaningful drag. Start answering (parent
        // decides whether that's inline or a sheet based on format).
        el.style.transform = 'translateY(0) scale(1)';
        onAnswer();
      } else {
        // Partial drag that didn't clear the skip threshold. Snap back.
        el.style.transform = 'translateY(0) scale(1)';
        if (sS) sS.style.opacity = '0';
      }
      dx = 0;
    };

    el.addEventListener('mousedown', start);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    return () => {
      el.removeEventListener('mousedown', start);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', end);
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
    };
  }, [depth, answering, onAnswer, onSkip]);

  // Keyboard entry point matching the pointer tap: Enter / Space on
  // the focused card starts answering. Skip stays on ← via the
  // window-level shortcut in deck_panel.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (depth !== 0 || answering) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onAnswer();
      }
    },
    [depth, answering, onAnswer],
  );

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
    },
    [],
  );

  const submit = useCallback(
    (params: { body?: string; choice_index?: number }) => {
      if (pending) return;
      setPending(true);
      setError(false);
      void (async () => {
        try {
          const updated = await apiAnswerKuestion(kuestion.id, {
            ...params,
            visibility_scope: scope,
          });
          onAnswered(updated);
        } catch {
          setError(true);
          setPending(false);
        }
      })();
    },
    [kuestion.id, onAnswered, pending, scope],
  );

  const handleSubmit = useCallback(() => {
    const body = text.trim();
    if (!body) return;
    submit({ body });
  }, [submit, text]);

  const handleChoicePick = useCallback(
    (idx: number) => {
      submit({ choice_index: idx });
    },
    [submit],
  );

  const handleCancelClick = useCallback(() => {
    setText('');
    setError(false);
    onCancel();
  }, [onCancel]);

  const askerAccount = createAccountFromServerJSON(kuestion.asker);
  const askerName = askerAccount.display_name || askerAccount.username;
  const handle = `@${kuestion.asker.acct}`;
  const count = kuestion.answers_count;
  const isLong = kuestion.title.length > 58;
  const canSend = text.trim() !== '' && !pending;

  return (
    <div
      ref={cardRef}
      className={`kuestions-deck__card${answering ? ' kuestions-deck__card--answering' : ''}`}
      role='button'
      tabIndex={depth === 0 ? 0 : -1}
      aria-label={intl.formatMessage(messages.tapToAnswer)}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={skipStampRef}
        className='kuestions-deck__stamp kuestions-deck__stamp--skip'
      >
        {intl.formatMessage(messages.skipStamp)}
      </div>

      <div className='kuestions-deck__asker'>
        <Avatar account={askerAccount} size={32} />
        <div className='kuestions-deck__asker-body'>
          <div className='kuestions-deck__asker-name'>{askerName}</div>
          <div className='kuestions-deck__asker-handle'>{handle}</div>
        </div>
        <div className='kuestions-deck__format-badge'>
          {intl.formatMessage(FORMAT_LABEL[kuestion.answer_format])}
        </div>
      </div>

      <div
        className={`kuestions-deck__qtext ${isLong ? 'kuestions-deck__qtext--long' : ''}`}
      >
        {kuestion.title}
      </div>

      {answering ? (
        <div className='kuestions-deck__answer'>
          {kuestion.answer_format === 'text' && (
            <>
              <textarea
                ref={textRef}
                className='kuestions-deck__answer-text'
                value={text}
                onChange={handleTextChange}
                placeholder={intl.formatMessage(messages.placeholder)}
                disabled={pending}
              />
              <KuestionScopePicker value={scope} onChange={setScope} />
            </>
          )}

          {(kuestion.answer_format === 'mc' ||
            kuestion.answer_format === 'yn') && (
            <>
              <p className='kuestions-deck__answer-hint'>
                {intl.formatMessage(messages.choiceHint)}
              </p>
              <InlineChoiceGrid
                options={kuestion.mc_options.map((o) => o.label)}
                layout={kuestion.answer_format}
                disabled={pending}
                onPick={handleChoicePick}
              />
            </>
          )}

          {error && (
            <p className='kuestions-deck__answer-error' role='alert'>
              <FormattedMessage {...messages.sendError} />
            </p>
          )}

          {kuestion.answer_format === 'text' && (
            <div className='kuestions-deck__answer-actions'>
              <button
                type='button'
                className='kuestions-btn kuestions-btn--ghost'
                onClick={handleCancelClick}
                disabled={pending}
              >
                {intl.formatMessage(messages.cancel)}
              </button>
              <button
                type='button'
                className='kuestions-btn'
                onClick={handleSubmit}
                disabled={!canSend}
              >
                {intl.formatMessage(pending ? messages.sending : messages.send)}
              </button>
            </div>
          )}

          {(kuestion.answer_format === 'mc' ||
            kuestion.answer_format === 'yn') && (
            <div className='kuestions-deck__answer-actions kuestions-deck__answer-actions--single'>
              <button
                type='button'
                className='kuestions-btn kuestions-btn--ghost'
                onClick={handleCancelClick}
                disabled={pending}
              >
                {intl.formatMessage(messages.cancel)}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className='kuestions-deck__locked'>
          <span className='kuestions-deck__lock' aria-hidden>
            <svg
              width='15'
              height='15'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
            >
              <rect x='3' y='11' width='18' height='11' rx='2' />
              <path d='M7 11V7a5 5 0 0 1 10 0v4' />
            </svg>
          </span>
          <div className='kuestions-deck__count'>
            {intl.formatMessage(messages.lockedCount, { count })}
          </div>
        </div>
      )}
    </div>
  );
};

// Inline choice grid for mc/yn kuestions — tap-to-pick chips
// rendered inside the card body (parallels the ChoiceGrid in
// answer_sheet.tsx but simpler layout tuned for the deck card's
// narrower slot).
interface InlineChoiceGridProps {
  options: string[];
  layout: 'mc' | 'yn';
  disabled: boolean;
  onPick: (idx: number) => void;
}

const InlineChoiceGrid: React.FC<InlineChoiceGridProps> = ({
  options,
  layout,
  disabled,
  onPick,
}) => (
  <div className={`kuestions-deck__choices kuestions-deck__choices--${layout}`}>
    {options.map((label, idx) => (
      <InlineChoiceButton
        key={label}
        label={label}
        idx={idx}
        layout={layout}
        disabled={disabled}
        onPick={onPick}
      />
    ))}
  </div>
);

interface InlineChoiceButtonProps {
  label: string;
  idx: number;
  layout: 'mc' | 'yn';
  disabled: boolean;
  onPick: (idx: number) => void;
}

const InlineChoiceButton: React.FC<InlineChoiceButtonProps> = ({
  label,
  idx,
  layout,
  disabled,
  onPick,
}) => {
  const handleClick = useCallback(() => {
    onPick(idx);
  }, [onPick, idx]);
  const isYn = layout === 'yn';
  const variant = isYn ? (idx === 0 ? 'yes' : 'no') : 'mc';
  return (
    <button
      type='button'
      className={`kuestions-deck__choice kuestions-deck__choice--${variant}`}
      onClick={handleClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
};
