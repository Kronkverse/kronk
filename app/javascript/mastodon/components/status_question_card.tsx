import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import LockIcon from '@/material-icons/400-24px/lock.svg?react';
import LockOpenIcon from '@/material-icons/400-24px/lock_open.svg?react';
import QuestionMarkIcon from '@/material-icons/400-24px/question_mark.svg?react';
import api from 'mastodon/api';
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
    defaultMessage: 'Answer to access answers',
  },
  placeholder: {
    id: 'status_question_card.placeholder',
    defaultMessage: 'Share your answer…',
  },
  cancel: {
    id: 'status_question_card.cancel',
    defaultMessage: 'Cancel',
  },
});

interface Answerer {
  id: string;
  username: string;
  acct: string;
  avatar: string;
}

export const StatusQuestionCard: React.FC<{
  postType: 'question' | 'answer';
  contentHtml: string;
  answersCount?: number;
  answerers?: Answerer[];
  hasAnswered?: boolean;
  statusId?: string;
  onCardClick?: (e: React.MouseEvent) => void;
}> = ({
  postType,
  contentHtml,
  answersCount = 0,
  answerers = [],
  hasAnswered = false,
  statusId,
  onCardClick,
}) => {
  const intl = useIntl();
  const [answering, setAnswering] = useState(false);
  const [answerText, setAnswerText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [postedAnswer, setPostedAnswer] = useState(false);

  const unlocked = hasAnswered || postedAnswer;

  const handleAnswerClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setAnswering(true);
  }, []);

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setAnswerText(e.target.value);
    },
    [],
  );

  const handleSubmit = useCallback(async () => {
    if (!answerText.trim() || submitting || !statusId) return;
    setSubmitting(true);
    try {
      await api().post('/api/v1/statuses', {
        status: answerText.trim(),
        post_type: 'answer',
        in_reply_to_id: statusId,
        visibility: 'public',
      });
      setAnswerText('');
      setAnswering(false);
      setPostedAnswer(true);
    } catch (err) {
      console.error('Failed to post answer:', err);
    } finally {
      setSubmitting(false);
    }
  }, [answerText, submitting, statusId]);

  const handleSubmitClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      void handleSubmit();
    },
    [handleSubmit],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleFooterClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleLockedKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ')
        handleAnswerClick(e as unknown as React.MouseEvent);
    },
    [handleAnswerClick],
  );

  const textareaRef = useCallback((node: HTMLTextAreaElement | null) => {
    if (node) node.focus();
  }, []);

  const handleCardKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') return;
      if ((e.key === 'Enter' || e.key === ' ') && onCardClick) {
        onCardClick(e as unknown as React.MouseEvent);
      }
    },
    [onCardClick],
  );

  return (
    <div
      className={`status-question-card status-question-card--${postType}`}
      style={
        { '--space-color': spaceColor('Questions') } as React.CSSProperties
      }
      onClick={onCardClick}
      onKeyDown={handleCardKeyDown}
      role={onCardClick ? 'button' : undefined}
      tabIndex={onCardClick ? 0 : undefined}
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

      <div
        className='status-question-card__body'
        dangerouslySetInnerHTML={{ __html: contentHtml }}
      />

      {postType === 'question' && (
        <div
          className='status-question-card__footer'
          onClick={handleFooterClick}
          role='presentation'
        >
          <Icon
            id={unlocked ? 'lock_open' : 'lock'}
            icon={unlocked ? LockOpenIcon : LockIcon}
            className={`status-question-card__lock ${unlocked ? 'status-question-card__lock--open' : ''}`}
          />

          {answerers.length > 0 && !answering && (
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

          {answering ? (
            <>
              <textarea
                ref={textareaRef}
                className='status-question-card__footer-input'
                placeholder={intl.formatMessage(messages.placeholder)}
                value={answerText}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                maxLength={500}
                rows={1}
              />
              <button
                className='status-question-card__footer-submit'
                onClick={handleSubmitClick}
                disabled={!answerText.trim() || submitting}
                aria-label='Post answer'
              >
                <Icon
                  id='question_mark'
                  icon={QuestionMarkIcon}
                  className='status-question-card__footer-submit-icon'
                />
              </button>
            </>
          ) : !unlocked && statusId ? (
            <span
              className='status-question-card__count status-question-card__count--locked'
              onClick={handleAnswerClick}
              role='button'
              tabIndex={0}
              onKeyDown={handleLockedKeyDown}
            >
              {answersCount > 0
                ? intl.formatMessage(messages.answers, {
                    count: answersCount,
                  })
                : intl.formatMessage(messages.locked)}
            </span>
          ) : (
            <span className='status-question-card__count'>
              {answersCount > 0
                ? intl.formatMessage(messages.answers, {
                    count: answersCount,
                  })
                : unlocked
                  ? intl.formatMessage(messages.answered)
                  : intl.formatMessage(messages.locked)}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
