import { defineMessages, useIntl } from 'react-intl';

import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

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
  // Icon sourced from the Kuestions manifest (see useKornerIcon.tsx),
  // so a rename in `config/korners/kuestions.yaml` propagates here for
  // free — same pattern the status space bar (#1195) already uses.
  const BadgeIcon = useKornerIcon('kuestions');

  return (
    <StatusKornerCard
      korner='Kuestions'
      variant='question'
      className='status-kuestions-card'
      to={`/hub/kuestions/${question.id}`}
      badge={{
        icon: BadgeIcon,
        iconId: 'kuestions',
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
      </div>
    </StatusKornerCard>
  );
};
