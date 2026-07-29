import { useCallback, useEffect, useRef } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type { ApiKuestionJSON } from 'mastodon/api_types/kuestions';
import { Avatar } from 'mastodon/components/avatar';
import { createAccountFromServerJSON } from 'mastodon/models/account';

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
});

const FORMAT_LABEL = {
  text: messages.formatText,
  mc: messages.formatMc,
  yn: messages.formatYn,
} as const;

// Interaction thresholds:
//   dx < -SKIP_THRESHOLD  → left-swipe skip
//   |dx| < TAP_THRESHOLD  → treat as a tap → open the answer sheet
//   anything in between   → snap back (no action)
// Right-swipe was retired: tapping is faster and matches the
// "just start typing" invariant the answer sheet promises.
const SKIP_THRESHOLD = 95;
const TAP_THRESHOLD = 8;

interface DeckCardProps {
  kuestion: ApiKuestionJSON;
  depth: number; // 0 = top card (interactive), 1..N = stacked behind
  onSkip: () => void;
  onAnswer: () => void;
}

// A single Kuestion card. Only the depth-0 card is interactive;
// deeper cards render smaller + slightly translated to signal stack
// depth without accepting input.
export const DeckCard: React.FC<DeckCardProps> = ({
  kuestion,
  depth,
  onSkip,
  onAnswer,
}) => {
  const intl = useIntl();
  const cardRef = useRef<HTMLDivElement>(null);
  const skipStampRef = useRef<HTMLDivElement>(null);
  // Note: `<article>` gave way to `<div role='button'>` for the outer
  // shell — the card is a tap target, not a content article, and
  // jsx-a11y flags role=button on <article>.

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
        // Tap / click — no meaningful drag. Open the answer sheet.
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
  }, [depth, onAnswer, onSkip]);

  // Keyboard entry point matching the pointer tap: Enter / Space on
  // the focused card opens the answer sheet. Skip stays on ← via the
  // window-level shortcut in deck_panel.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (depth !== 0) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onAnswer();
      }
    },
    [depth, onAnswer],
  );

  const askerAccount = createAccountFromServerJSON(kuestion.asker);
  const askerName = askerAccount.display_name || askerAccount.username;
  const handle = `@${kuestion.asker.acct}`;
  const count = kuestion.answers_count;
  const isLong = kuestion.title.length > 58;

  return (
    <div
      ref={cardRef}
      className='kuestions-deck__card'
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
    </div>
  );
};
