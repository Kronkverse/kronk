import { useCallback, useEffect, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { useLocation } from 'react-router-dom';

import {
  apiGetKuestion,
  apiListAnsweredKuestions,
} from 'mastodon/api/kuestions';
import type { ApiKuestionJSON } from 'mastodon/api_types/kuestions';
import { Avatar } from 'mastodon/components/avatar';
import { createAccountFromServerJSON } from 'mastodon/models/account';

import { AnswerSheet } from './answer_sheet';
import { RevealSheet } from './reveal_sheet';

const messages = defineMessages({
  loading: { id: 'kuestions.loading', defaultMessage: 'Loading…' },
  formatText: { id: 'kuestions.format.text', defaultMessage: 'Free text' },
  formatMc: { id: 'kuestions.format.mc', defaultMessage: 'Multiple choice' },
  formatYn: { id: 'kuestions.format.yn', defaultMessage: 'Yes / No' },
  answersLabel: {
    id: 'kuestions.answered.answers_label',
    defaultMessage: '{count, plural, one {# answer} other {# answers}}',
  },
  youAsked: { id: 'kuestions.answered.you_asked', defaultMessage: 'You asked' },
  yourAnswer: {
    id: 'kuestions.answered.your_answer',
    defaultMessage: 'Your answer',
  },
  addOwnAnswer: {
    id: 'kuestions.ask.add_own_answer',
    defaultMessage: 'Answer your own',
  },
});

const FORMAT_LABEL = {
  text: messages.formatText,
  mc: messages.formatMc,
  yn: messages.formatYn,
} as const;

interface AnsweredPanelProps {
  onGoDeck: () => void;
  // Bumped by the parent when a kuestion is posted from the composer
  // overlay, so the new ask shows up without a reload.
  refreshKey: number;
}

// Answered = what the viewer has answered plus what they have asked
// (Yours merged in here 2026-10-12), each row carrying the viewer's
// own answer. Tap a row → the reveal sheet with fresh detail. An ask
// the viewer hasn't answered gets "Answer your own" (the asker is
// exempt from the gate, so they can see answers either way).
export const AnsweredPanel: React.FC<AnsweredPanelProps> = ({
  onGoDeck,
  refreshKey,
}) => {
  const intl = useIntl();
  const [list, setList] = useState<ApiKuestionJSON[] | null>(null);
  const [answering, setAnswering] = useState<ApiKuestionJSON | null>(null);
  const [revealing, setRevealing] = useState<ApiKuestionJSON | null>(null);

  useEffect(() => {
    void (async () => {
      setList(null);
      try {
        const data = await apiListAnsweredKuestions();
        setList(data);
      } catch {
        setList([]);
      }
    })();
  }, [refreshKey]);

  const handleOpen = useCallback((id: string) => {
    void (async () => {
      try {
        const detail = await apiGetKuestion(id);
        setRevealing(detail);
      } catch {
        // silent — surface an error UI in a follow-up if needed
      }
    })();
  }, []);

  // `?k=<id>` opens that Kuestion's answers: where a notification about a
  // Kuestion, or a link to an answer's post, lands.
  const { search } = useLocation();
  const linked = new URLSearchParams(search).get('k');
  useEffect(() => {
    if (linked) handleOpen(linked);
  }, [linked, handleOpen]);

  const handleAnswer = useCallback((k: ApiKuestionJSON) => {
    setAnswering(k);
  }, []);

  const handleCancelAnswer = useCallback(() => {
    setAnswering(null);
  }, []);

  // The answer endpoint returns the Kuestion without `my_answer`, so
  // refetch the list to pick up the new answer on the row.
  const handleAnswered = useCallback((updated: ApiKuestionJSON) => {
    setAnswering(null);
    setRevealing(updated);
    void apiListAnsweredKuestions()
      .then(setList)
      .catch(() => undefined);
  }, []);

  const handleGoDeck = useCallback(() => {
    onGoDeck();
  }, [onGoDeck]);

  const handleCloseReveal = useCallback(() => {
    setRevealing(null);
  }, []);

  if (list === null) {
    return (
      <section className='kuestions-panel'>
        <p className='space-subtitle'>{intl.formatMessage(messages.loading)}</p>
      </section>
    );
  }

  if (list.length === 0) {
    return (
      <section className='kuestions-panel'>
        <div className='kuestions-empty'>
          <h3>
            <FormattedMessage
              id='kuestions.answered.empty_title'
              defaultMessage='Nothing here yet'
            />
          </h3>
          <p>
            <FormattedMessage
              id='kuestions.answered.empty_body'
              defaultMessage='Answer a kuestion or ask one and it lands here.'
            />
          </p>
          <button
            type='button'
            className='kuestions-btn'
            onClick={handleGoDeck}
          >
            <FormattedMessage
              id='kuestions.answered.open_deck'
              defaultMessage='Open the deck'
            />
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className='kuestions-panel'>
      <ul className='kuestions-answered'>
        {list.map((k) => (
          <AnsweredRow
            key={k.id}
            kuestion={k}
            onOpen={handleOpen}
            onAnswer={handleAnswer}
          />
        ))}
      </ul>

      {answering && (
        <AnswerSheet
          kuestion={answering}
          onCancel={handleCancelAnswer}
          onSubmitted={handleAnswered}
        />
      )}
      {revealing && (
        <RevealSheet kuestion={revealing} onNext={handleCloseReveal} />
      )}
    </section>
  );
};

interface AnsweredRowProps {
  kuestion: ApiKuestionJSON;
  onOpen: (id: string) => void;
  onAnswer: (k: ApiKuestionJSON) => void;
}

const AnsweredRow: React.FC<AnsweredRowProps> = ({
  kuestion,
  onOpen,
  onAnswer,
}) => {
  const intl = useIntl();
  const asker = createAccountFromServerJSON(kuestion.asker);
  const handleClick = useCallback(() => {
    onOpen(kuestion.id);
  }, [kuestion.id, onOpen]);
  const handleAnswer = useCallback(() => {
    onAnswer(kuestion);
  }, [kuestion, onAnswer]);

  return (
    <li className='kuestions-answered__row'>
      <div className='kuestions-answered__card'>
        <button
          type='button'
          className='kuestions-answered__open'
          onClick={handleClick}
        >
          <Avatar account={asker} size={32} />
          <div className='kuestions-answered__body'>
            <div className='kuestions-answered__q'>{kuestion.title}</div>
            {kuestion.my_answer && (
              <div className='kuestions-answered__mine'>
                <span className='sr-only'>
                  {intl.formatMessage(messages.yourAnswer)}:{' '}
                </span>
                {kuestion.my_answer.body}
              </div>
            )}
            <div className='kuestions-answered__meta'>
              {kuestion.asked_by_me
                ? intl.formatMessage(messages.youAsked)
                : asker.display_name || asker.username}{' '}
              · {intl.formatMessage(FORMAT_LABEL[kuestion.answer_format])} ·{' '}
              {intl.formatMessage(messages.answersLabel, {
                count: kuestion.answers_count,
              })}
            </div>
          </div>
        </button>
        {kuestion.asked_by_me && !kuestion.has_answered && (
          <div className='kuestions-answered__actions'>
            <button
              type='button'
              className='kuestions-btn kuestions-btn--ghost kuestions-btn--sm'
              onClick={handleAnswer}
            >
              {intl.formatMessage(messages.addOwnAnswer)}
            </button>
          </div>
        )}
      </div>
    </li>
  );
};
