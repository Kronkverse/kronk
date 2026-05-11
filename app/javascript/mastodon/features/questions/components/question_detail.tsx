import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import LockIcon from '@/material-icons/400-24px/lock.svg?react';
import api from 'mastodon/api';
import { Icon } from 'mastodon/components/icon';

import type { Answer, Question } from '../types';

import { AnswerComposer } from './answer_composer';

const messages = defineMessages({
  back: { id: 'questions.detail.back', defaultMessage: 'Back' },
  lockedTitle: {
    id: 'questions.detail.locked_title',
    defaultMessage: 'Answer to see what others think',
  },
  lockedBody: {
    id: 'questions.detail.locked_body',
    defaultMessage:
      'Answers are hidden until you share yours. Answer the question to unlock all responses.',
  },
  answerPrompt: {
    id: 'questions.detail.answer_prompt',
    defaultMessage: 'Share your answer',
  },
  answersTitle: {
    id: 'questions.detail.answers_title',
    defaultMessage: '{count, plural, one {# answer} other {# answers}}',
  },
});

export const QuestionDetail: React.FC<{
  question: Question;
  onBack: () => void;
  onAnswered: (updated: Question) => void;
  initiallyAnswering?: boolean;
}> = ({ question, onBack, onAnswered, initiallyAnswering = false }) => {
  const intl = useIntl();
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [locked, setLocked] = useState(!question.has_answered);
  const [showComposer, setShowComposer] = useState(initiallyAnswering);
  const [loading, setLoading] = useState(false);

  const fetchAnswers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api().get(`/api/v1/questions/${question.id}/answers`);
      const data = res.data as
        | { answers: Answer[]; locked?: boolean }
        | Answer[];
      if (Array.isArray(data)) {
        setAnswers(data);
        setLocked(false);
      } else if (data.locked) {
        setLocked(true);
      } else {
        setAnswers(data.answers);
        setLocked(false);
      }
    } catch (err) {
      console.error('Failed to fetch answers:', err);
    } finally {
      setLoading(false);
    }
  }, [question.id]);

  useEffect(() => {
    void fetchAnswers();
  }, [fetchAnswers]);

  const handleAnswered = useCallback(
    (answer: Answer) => {
      setAnswers((prev) => [...prev, answer]);
      setLocked(false);
      setShowComposer(false);
      onAnswered({
        ...question,
        has_answered: true,
        answers_count: question.answers_count + 1,
      });
    },
    [question, onAnswered],
  );

  const handleShowComposer = useCallback(() => {
    setShowComposer(true);
  }, []);

  const handleHideComposer = useCallback(() => {
    setShowComposer(false);
  }, []);

  return (
    <div className='question-detail'>
      <button className='question-detail__back' onClick={onBack}>
        ← {intl.formatMessage(messages.back)}
      </button>

      <div className='question-detail__question'>
        <div className='question-detail__question-header'>
          <img
            className='question-detail__avatar'
            src={question.account.avatar}
            alt={question.account.username}
          />
          <div>
            <span className='question-detail__display-name'>
              {question.account.display_name || question.account.username}
            </span>
            <span className='question-detail__acct'>
              @{question.account.acct}
            </span>
          </div>
        </div>
        <div
          className='question-detail__content'
          dangerouslySetInnerHTML={{ __html: question.content }}
        />
      </div>

      {locked ? (
        <div className='question-detail__locked'>
          <Icon
            id='lock'
            icon={LockIcon}
            className='question-detail__lock-icon'
          />
          <h3 className='question-detail__locked-title'>
            {intl.formatMessage(messages.lockedTitle)}
          </h3>
          <p className='question-detail__locked-body'>
            {intl.formatMessage(messages.lockedBody)}
          </p>
          {showComposer ? (
            <AnswerComposer
              question={question}
              onAnswered={handleAnswered}
              onCancel={handleHideComposer}
            />
          ) : (
            <button
              className='question-detail__answer-cta'
              onClick={handleShowComposer}
            >
              {intl.formatMessage(messages.answerPrompt)}
            </button>
          )}
        </div>
      ) : (
        <div className='question-detail__answers'>
          {!loading && (
            <h3 className='question-detail__answers-title'>
              {intl.formatMessage(messages.answersTitle, {
                count: answers.length,
              })}
            </h3>
          )}

          {answers.map((answer) => (
            <div key={answer.id} className='question-detail__answer'>
              <div className='question-detail__answer-header'>
                <img
                  className='question-detail__answer-avatar'
                  src={answer.account.avatar}
                  alt={answer.account.username}
                />
                <div>
                  <span className='question-detail__answer-name'>
                    {answer.account.display_name || answer.account.username}
                  </span>
                  <span className='question-detail__answer-acct'>
                    @{answer.account.acct}
                  </span>
                </div>
              </div>
              <div
                className='question-detail__answer-content'
                dangerouslySetInnerHTML={{ __html: answer.content }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
