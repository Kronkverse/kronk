import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import LockIcon from '@/material-icons/400-24px/lock.svg?react';
import LockOpenIcon from '@/material-icons/400-24px/lock_open.svg?react';
import { Icon } from 'mastodon/components/icon';

import type { Question } from '../types';

import { AnswerComposer } from './answer_composer';

const messages = defineMessages({
  answer: { id: 'questions.card.answer', defaultMessage: 'Answer' },
  answered: { id: 'questions.card.answered', defaultMessage: 'Answered' },
  peopleAnswered: {
    id: 'questions.card.people_answered',
    defaultMessage: '{count, plural, one {# answer} other {# answers}}',
  },
});

const parseContent = (html: string) => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || '';
};

export const QuestionCard: React.FC<{
  question: Question;
  onSelect: (id: string) => void;
}> = ({ question, onSelect }) => {
  const intl = useIntl();
  const [answering, setAnswering] = useState(false);

  const handleCardClick = useCallback(() => {
    onSelect(question.id);
  }, [onSelect, question.id]);

  const handleCardKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(question.id);
      }
    },
    [onSelect, question.id],
  );

  const handleAnswerClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setAnswering(true);
  }, []);

  const handleAnswerCancel = useCallback(() => {
    setAnswering(false);
  }, []);

  const handleAnswered = useCallback(() => {
    setAnswering(false);
  }, []);

  const handleComposerClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const plainText = parseContent(question.content);

  return (
    <div
      className='question-card'
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      role='button'
      tabIndex={0}
    >
      <div className='question-card__header'>
        <img
          className='question-card__avatar'
          src={question.account.avatar}
          alt={question.account.username}
        />
        <div className='question-card__meta'>
          <span className='question-card__display-name'>
            {question.account.display_name || question.account.username}
          </span>
          <span className='question-card__acct'>@{question.account.acct}</span>
        </div>
      </div>

      <p className='question-card__text'>{plainText}</p>

      <div className='question-card__footer'>
        <div className='question-card__engagement'>
          <Icon
            id={question.has_answered ? 'lock_open' : 'lock'}
            icon={question.has_answered ? LockOpenIcon : LockIcon}
            className={
              question.has_answered
                ? 'question-card__lock--open'
                : 'question-card__lock--closed'
            }
          />

          {question.answers_count > 0 && (
            <div className='question-card__answerers'>
              {question.answerers.slice(0, 5).map((a) => (
                <img
                  key={a.id}
                  className='question-card__answerer-avatar'
                  src={a.avatar}
                  alt={a.username}
                  title={`@${a.acct}`}
                />
              ))}
              <span className='question-card__answer-count'>
                {intl.formatMessage(messages.peopleAnswered, {
                  count: question.answers_count,
                })}
              </span>
            </div>
          )}
        </div>

        {question.has_answered ? (
          <span className='question-card__answered-badge'>
            {intl.formatMessage(messages.answered)}
          </span>
        ) : (
          <button
            className='question-card__answer-btn'
            onClick={handleAnswerClick}
          >
            {intl.formatMessage(messages.answer)}
          </button>
        )}
      </div>

      {answering && (
        <div onClick={handleComposerClick} role='presentation'>
          <AnswerComposer
            question={question}
            onAnswered={handleAnswered}
            onCancel={handleAnswerCancel}
          />
        </div>
      )}
    </div>
  );
};
