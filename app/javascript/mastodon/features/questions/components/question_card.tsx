import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import LockIcon from '@/material-icons/400-24px/lock.svg?react';
import LockOpenIcon from '@/material-icons/400-24px/lock_open.svg?react';
import { Icon } from 'mastodon/components/icon';

import type { Question } from '../types';

const messages = defineMessages({
  answered: { id: 'questions.card.answered', defaultMessage: 'Answered ✓' },
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
}> = ({ question }) => {
  const intl = useIntl();
  const history = useHistory();
  const hasAnswered = question.has_answered;
  const answersCount = question.answers_count;

  const handleCardClick = useCallback(() => {
    history.push(`/questions/${question.id}`);
  }, [history, question.id]);

  const handleCardKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        history.push(`/questions/${question.id}`);
      }
    },
    [history, question.id],
  );

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
            id={hasAnswered ? 'lock_open' : 'lock'}
            icon={hasAnswered ? LockOpenIcon : LockIcon}
            className={
              hasAnswered
                ? 'question-card__lock--open'
                : 'question-card__lock--closed'
            }
          />

          {answersCount > 0 && (
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
                  count: answersCount,
                })}
              </span>
            </div>
          )}
        </div>

        {hasAnswered && (
          <span className='question-card__answered-badge'>
            {intl.formatMessage(messages.answered)}
          </span>
        )}
      </div>
    </div>
  );
};
