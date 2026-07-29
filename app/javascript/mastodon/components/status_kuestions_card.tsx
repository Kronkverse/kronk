import { defineMessages, useIntl } from 'react-intl';

import QuestionMarkIcon from '@/material-icons/400-24px/question_mark.svg?react';

import { StatusKornerCard } from './status_korner_card';

const messages = defineMessages({
  badge: {
    id: 'status_kuestions_card.badge',
    defaultMessage: 'KUESTION',
  },
  answers: {
    id: 'status_kuestions_card.answers',
    defaultMessage: '{count, plural, one {# answer} other {# answers}}',
  },
  answer: {
    id: 'status_kuestions_card.answer',
    defaultMessage: 'Answer →',
  },
  unlock: {
    id: 'status_kuestions_card.unlock',
    defaultMessage: 'Answer to unlock →',
  },
});

interface AnswererAvatar {
  id: string;
  acct: string;
  avatar: string;
}

interface QuestionSummary {
  id: string;
  title: string;
  prompt: string | null;
  answer_format: 'text' | 'mc' | 'yn';
  answers_count: number;
  has_answered: boolean;
  recent_answerer_avatars: AnswererAvatar[];
}

export const StatusKuestionsCard: React.FC<{ question: QuestionSummary }> = ({
  question,
}) => {
  const intl = useIntl();

  const ctaMessage = question.has_answered ? messages.answer : messages.unlock;

  return (
    <StatusKornerCard
      korner='Kuestions'
      variant='question'
      className='status-kuestions-card'
      to={`/hub/kuestions/${question.id}`}
      badge={{
        icon: QuestionMarkIcon,
        iconId: 'question_mark',
        label: intl.formatMessage(messages.badge),
      }}
    >
      <div className='status-korner-card__body status-kuestions-card__body'>
        <div className='status-kuestions-card__title'>{question.title}</div>
        {question.prompt && (
          <div className='status-kuestions-card__prompt'>{question.prompt}</div>
        )}
      </div>

      <div className='status-korner-card__footer status-kuestions-card__footer'>
        <div className='status-korner-card__meta'>
          <span className='status-kuestions-card__count'>
            {intl.formatMessage(messages.answers, {
              count: question.answers_count,
            })}
          </span>
          {question.recent_answerer_avatars.length > 0 && (
            <div className='status-kuestions-card__avatars'>
              {question.recent_answerer_avatars.slice(0, 5).map((a) => (
                <img
                  key={a.id}
                  className='status-kuestions-card__avatar'
                  src={a.avatar}
                  alt={a.acct}
                />
              ))}
            </div>
          )}
        </div>
        <span className='status-korner-card__action'>
          {intl.formatMessage(ctaMessage)}
        </span>
      </div>
    </StatusKornerCard>
  );
};
