import { useCallback, useEffect, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import {
  apiListKuestions,
  apiSkipKuestion,
  apiUnskipKuestion,
} from 'mastodon/api/kuestions';
import type { ApiKuestionJSON } from 'mastodon/api_types/kuestions';

import { DeckCard } from './deck_card';

const messages = defineMessages({
  loading: { id: 'kuestions.loading', defaultMessage: 'Loading…' },
  waiting: {
    id: 'kuestions.deck.waiting',
    defaultMessage: '{count, plural, one {# waiting} other {# waiting}}',
  },
  caughtUp: {
    id: 'kuestions.deck.caught_up',
    defaultMessage: 'all caught up',
  },
  skip: { id: 'kuestions.control.skip', defaultMessage: 'Skip' },
  undo: { id: 'kuestions.control.undo', defaultMessage: 'Undo' },
  answer: { id: 'kuestions.control.answer', defaultMessage: 'Answer' },
});

// Undo history stack — the last few actions the user took, so the
// undo button can put them back on the deck. Skip actions are the
// only reversible thing here (an answer, once submitted, is a Real
// Thing on the server and can't be un-answered — the brief).
interface SkipAction {
  kind: 'skip';
  kuestion: ApiKuestionJSON;
}
type UndoEntry = SkipAction;

export const DeckPanel: React.FC = () => {
  const intl = useIntl();
  const [deck, setDeck] = useState<ApiKuestionJSON[] | null>(null);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const list = await apiListKuestions();
        setDeck(list);
      } catch {
        setDeck([]);
      }
    })();
  }, []);

  // Remove the top card from the deck; push a skip action so undo can
  // restore it.
  const skipTop = useCallback(() => {
    if (pending) return;
    setDeck((prev) => {
      if (!prev || prev.length === 0) return prev;
      const [top, ...rest] = prev;
      if (!top) return prev;
      setUndoStack((s) => [...s, { kind: 'skip', kuestion: top }]);
      setPending(true);
      void (async () => {
        try {
          await apiSkipKuestion(top.id);
        } finally {
          setPending(false);
        }
      })();
      return rest;
    });
  }, [pending]);

  // Undo the most recent skip: reinsert the Kuestion at the top of
  // the deck and DELETE the skip row so it can appear again in future
  // fetches.
  const undoLast = useCallback(() => {
    setUndoStack((s) => {
      if (s.length === 0) return s;
      const next = [...s];
      const entry = next.pop();
      if (!entry) return s;
      setPending(true);
      void (async () => {
        try {
          await apiUnskipKuestion(entry.kuestion.id);
          setDeck((prev) => [entry.kuestion, ...(prev ?? [])]);
        } finally {
          setPending(false);
        }
      })();
      return next;
    });
  }, []);

  const answerTop = useCallback(() => {
    // Phase 2c wires the answer sheet. For now: log-and-drop so the
    // control is live for QA of gestures + keyboard, without any
    // network write.
    setDeck((prev) => (prev && prev.length > 0 ? prev.slice(1) : prev));
  }, []);

  // Keyboard: ← skip, → answer. Bail on typing surfaces so the deck
  // doesn't hijack keys the user meant for a textbox.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'TEXTAREA' ||
          target.tagName === 'INPUT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'ArrowLeft') skipTop();
      else if (e.key === 'ArrowRight') answerTop();
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [skipTop, answerTop]);

  if (deck === null) {
    return (
      <section className='kuestions-panel'>
        <h1 className='kuestions-wordmark'>Ƙuestions</h1>
        <p className='kuestions-sub'>{intl.formatMessage(messages.loading)}</p>
      </section>
    );
  }

  const remaining = deck.length;
  const stackedTop = deck.slice(0, 3);

  return (
    <section className='kuestions-panel'>
      <h1 className='kuestions-wordmark'>Ƙuestions</h1>
      <p className='kuestions-sub'>
        <FormattedMessage
          id='kuestions.deck.subtitle'
          defaultMessage='Answer to unlock. {left}'
          values={{
            left: (
              <b>
                {remaining > 0
                  ? intl.formatMessage(messages.waiting, { count: remaining })
                  : intl.formatMessage(messages.caughtUp)}
              </b>
            ),
          }}
        />
      </p>

      <div className='kuestions-deck'>
        {remaining === 0 ? (
          <div className='kuestions-empty'>
            <h3>
              <FormattedMessage
                id='kuestions.deck.empty_title'
                defaultMessage='All caught up'
              />
            </h3>
            <p>
              <FormattedMessage
                id='kuestions.deck.empty_body'
                defaultMessage="You've answered everything in range. New kuestions land here as the community asks them."
              />
            </p>
          </div>
        ) : (
          stackedTop
            .slice()
            .reverse()
            .map((k, idx, arr) => (
              <DeckCard
                key={k.id}
                kuestion={k}
                depth={arr.length - 1 - idx}
                onSkip={skipTop}
                onAnswer={answerTop}
              />
            ))
        )}
      </div>

      {remaining > 0 && (
        <div className='kuestions-deck__controls'>
          <button
            type='button'
            className='kuestions-deck__ctl'
            onClick={skipTop}
            aria-label={intl.formatMessage(messages.skip)}
          >
            <svg
              width='22'
              height='22'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
            >
              <path d='M18 6 6 18M6 6l12 12' />
            </svg>
          </button>
          <button
            type='button'
            className='kuestions-deck__ctl kuestions-deck__ctl--undo'
            onClick={undoLast}
            disabled={undoStack.length === 0}
            aria-label={intl.formatMessage(messages.undo)}
          >
            <svg
              width='17'
              height='17'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
            >
              <path d='M3 7v6h6' />
              <path d='M3.5 13a9 9 0 1 0 2.1-5.9L3 10' />
            </svg>
          </button>
          <button
            type='button'
            className='kuestions-deck__ctl kuestions-deck__ctl--answer'
            onClick={answerTop}
            aria-label={intl.formatMessage(messages.answer)}
          >
            <svg
              width='22'
              height='22'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
            >
              <path d='M12 20h9' />
              <path d='M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z' />
            </svg>
          </button>
        </div>
      )}
    </section>
  );
};
