import { defineMessages, useIntl } from 'react-intl';

import LockIcon from '@/material-icons/400-24px/lock.svg?react';
import LockOpenIcon from '@/material-icons/400-24px/lock_open.svg?react';
import QuestionMarkIcon from '@/material-icons/400-24px/question_mark.svg?react';
import { Icon } from 'mastodon/components/icon';
import { spaceColor } from 'mastodon/planets';

const messages = defineMessages({
  question: {
    id: 'status_question_card.question',
    defaultMessage: 'Question',
  },
  answer: {
    id: 'status_question_card.answer',
    defaultMessage: 'Answer',
  },
  originalQuestion: {
    id: 'status_question_card.original_question',
    defaultMessage: 'In answer to',
  },
  answers: {
    id: 'status_question_card.answers',
    defaultMessage: '{count, plural, one {# answer} other {# answers}}',
  },
  answered: {
    id: 'status_question_card.answered',
    defaultMessage: 'You answered',
  },
  locked: {
    id: 'status_question_card.locked',
    defaultMessage: 'Answer to unlock',
  },
});

interface Answerer {
  id: string;
  username: string;
  acct: string;
  avatar: string;
}

interface ParentQuestion {
  content: string;
  account?: {
    display_name?: string;
    username: string;
  };
}

const stripHtml = (html: string) => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || '';
};

export const StatusQuestionCard: React.FC<{
  postType: 'question' | 'answer';
  contentHtml: string;
  answersCount?: number;
  answerers?: Answerer[];
  hasAnswered?: boolean;
  question?: ParentQuestion;
}> = ({
  postType,
  contentHtml,
  answersCount = 0,
  answerers = [],
  hasAnswered = false,
  question,
}) => {
  const intl = useIntl();

  return (
    <div
      className={`status-question-card status-question-card--${postType}`}
      style={
        { '--space-color': spaceColor('Questions') } as React.CSSProperties
      }
    >
      <div className='status-question-card__badge'>
        <Icon
          id='question_mark'
          icon={QuestionMarkIcon}
          className='status-question-card__badge-icon'
        />
        <span>
          {postType === 'question'
            ? intl.formatMessage(messages.question)
            : intl.formatMessage(messages.answer)}
        </span>
      </div>

      {postType === 'answer' && question && (
        <div className='status-question-card__question-ref'>
          <div className='status-question-card__question-ref-label'>
            {intl.formatMessage(messages.originalQuestion)}
          </div>
          <div className='status-question-card__question-ref-text'>
            {stripHtml(question.content)}
          </div>
        </div>
      )}

      <div
        className='status-question-card__body'
        dangerouslySetInnerHTML={{ __html: contentHtml }}
      />

      {postType === 'question' && (
        <div className='status-question-card__footer'>
          <Icon
            id={hasAnswered ? 'lock_open' : 'lock'}
            icon={hasAnswered ? LockOpenIcon : LockIcon}
            className={`status-question-card__lock ${hasAnswered ? 'status-question-card__lock--open' : ''}`}
          />

          {answerers.length > 0 && (
            <div className='status-question-card__answerers'>
              {answerers.slice(0, 5).map((a) => (
                <img
                  key={a.id}
                  className='status-question-card__answerer-avatar'
                  src={a.avatar}
                  alt={a.username}
                  title={`@${a.acct}`}
                />
              ))}
            </div>
          )}

          <span className='status-question-card__count'>
            {answersCount > 0
              ? intl.formatMessage(messages.answers, { count: answersCount })
              : hasAnswered
                ? intl.formatMessage(messages.answered)
                : intl.formatMessage(messages.locked)}
          </span>
        </div>
      )}
    </div>
  );
};
