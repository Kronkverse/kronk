import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiGetKuestion, apiListMyKuestions } from 'mastodon/api/kuestions';
import type { ApiKuestionJSON } from 'mastodon/api_types/kuestions';
import { Avatar } from 'mastodon/components/avatar';
import { createAccountFromServerJSON } from 'mastodon/models/account';

import { AnswerSheet } from './answer_sheet';
import { RevealSheet } from './reveal_sheet';

// Yours panel — the caller's own kuestions with the running count and,
// for anything they haven't answered yet, an "Answer your own" button
// (asker is exempt from the visibility gate; the answer sheet is the
// same one the Deck uses). Tapping "See answers" opens the reveal
// sheet, which under the asker-bypass shows every answer regardless
// of whether the asker has locked in one of their own.
//
// Was `MyAsksList` inside the full-page `AskPanel` at /hub/kuestions/ask
// until 2026-08-12. The composer that used to share this page is now
// a `<ComposeShell>` overlay opened via the Ж bubble (see
// `kuestion_composer.tsx` + docs/rebuild/decisions.md 2026-08-12).
// The `refreshKey` prop lets the parent bump the list when a new
// kuestion is posted from the shell so it shows up immediately.

const messages = defineMessages({
  formatText: { id: 'kuestions.format.text', defaultMessage: 'Free text' },
  formatMc: { id: 'kuestions.format.mc', defaultMessage: 'Multiple choice' },
  formatYn: { id: 'kuestions.format.yn', defaultMessage: 'Yes / No' },
  answersLabel: {
    id: 'kuestions.ask.answers_label',
    defaultMessage: '{count, plural, one {# answer} other {# answers}}',
  },
  addOwnAnswer: {
    id: 'kuestions.ask.add_own_answer',
    defaultMessage: 'Answer your own',
  },
  seeAnswers: {
    id: 'kuestions.ask.see_answers',
    defaultMessage: 'See answers',
  },
  myAsksHeading: {
    id: 'kuestions.ask.my_asks_heading',
    defaultMessage: 'Your kuestions',
  },
  myAsksEmpty: {
    id: 'kuestions.ask.my_asks_empty',
    defaultMessage: "You haven't asked anything yet.",
  },
  myAsksLoading: {
    id: 'kuestions.ask.my_asks_loading',
    defaultMessage: 'Loading your kuestions…',
  },
});

const FORMAT_LABEL = {
  text: messages.formatText,
  mc: messages.formatMc,
  yn: messages.formatYn,
} as const;

interface Props {
  // Bumped by the parent when a fresh kuestion is posted (from the
  // composer overlay), so the list refetches and the new row appears
  // without the user having to reload.
  refreshKey: number;
}

export const YoursPanel: React.FC<Props> = ({ refreshKey }) => {
  const intl = useIntl();
  const [list, setList] = useState<ApiKuestionJSON[] | null>(null);
  const [answering, setAnswering] = useState<ApiKuestionJSON | null>(null);
  const [revealing, setRevealing] = useState<ApiKuestionJSON | null>(null);

  useEffect(() => {
    void (async () => {
      setList(null);
      try {
        const data = await apiListMyKuestions();
        setList(data);
      } catch {
        setList([]);
      }
    })();
  }, [refreshKey]);

  const openReveal = useCallback((id: string) => {
    void (async () => {
      try {
        const detail = await apiGetKuestion(id);
        setRevealing(detail);
      } catch {
        // Silent — reveal is opportunistic, no strong error UI yet.
      }
    })();
  }, []);

  const openAnswer = useCallback((k: ApiKuestionJSON) => {
    setAnswering(k);
  }, []);

  const closeAnswer = useCallback(() => {
    setAnswering(null);
  }, []);

  const closeReveal = useCallback(() => {
    setRevealing(null);
  }, []);

  const handleAnswered = useCallback((updated: ApiKuestionJSON) => {
    setAnswering(null);
    setList((prev) =>
      prev ? prev.map((k) => (k.id === updated.id ? updated : k)) : prev,
    );
    setRevealing(updated);
  }, []);

  if (list === null) {
    return (
      <section className='kuestions-panel'>
        <p className='space-subtitle'>
          {intl.formatMessage(messages.myAsksLoading)}
        </p>
      </section>
    );
  }

  if (list.length === 0) {
    return (
      <section className='kuestions-panel'>
        <h3 className='kuestions-ask__my-heading'>
          {intl.formatMessage(messages.myAsksHeading)}
        </h3>
        <p className='space-subtitle'>
          {intl.formatMessage(messages.myAsksEmpty)}
        </p>
      </section>
    );
  }

  return (
    <section className='kuestions-panel'>
      <h3 className='kuestions-ask__my-heading'>
        {intl.formatMessage(messages.myAsksHeading)}
      </h3>

      <ul className='kuestions-answered'>
        {list.map((k) => (
          <MyAskRow
            key={k.id}
            kuestion={k}
            onSeeAnswers={openReveal}
            onAnswer={openAnswer}
          />
        ))}
      </ul>

      {answering && (
        <AnswerSheet
          kuestion={answering}
          defaultScope='mates'
          onCancel={closeAnswer}
          onSubmitted={handleAnswered}
        />
      )}
      {revealing && <RevealSheet kuestion={revealing} onNext={closeReveal} />}
    </section>
  );
};

interface MyAskRowProps {
  kuestion: ApiKuestionJSON;
  onSeeAnswers: (id: string) => void;
  onAnswer: (k: ApiKuestionJSON) => void;
}

const MyAskRow: React.FC<MyAskRowProps> = ({
  kuestion,
  onSeeAnswers,
  onAnswer,
}) => {
  const intl = useIntl();
  const asker = createAccountFromServerJSON(kuestion.asker);

  const handleSeeAnswers = useCallback(() => {
    onSeeAnswers(kuestion.id);
  }, [kuestion.id, onSeeAnswers]);

  const handleAnswer = useCallback(() => {
    onAnswer(kuestion);
  }, [kuestion, onAnswer]);

  return (
    <li className='kuestions-answered__row'>
      <div className='kuestions-answered__button kuestions-answered__button--static'>
        <Avatar account={asker} size={32} />
        <div className='kuestions-answered__body'>
          <div className='kuestions-answered__q'>{kuestion.title}</div>
          <div className='kuestions-answered__meta'>
            {intl.formatMessage(FORMAT_LABEL[kuestion.answer_format])} ·{' '}
            {intl.formatMessage(messages.answersLabel, {
              count: kuestion.answers_count,
            })}
          </div>
        </div>
        <div className='kuestions-answered__actions'>
          {!kuestion.has_answered && (
            <button
              type='button'
              className='kuestions-btn kuestions-btn--ghost kuestions-btn--sm'
              onClick={handleAnswer}
            >
              {intl.formatMessage(messages.addOwnAnswer)}
            </button>
          )}
          <button
            type='button'
            className='kuestions-btn kuestions-btn--sm'
            onClick={handleSeeAnswers}
          >
            {intl.formatMessage(messages.seeAnswers)}
          </button>
        </div>
      </div>
    </li>
  );
};
