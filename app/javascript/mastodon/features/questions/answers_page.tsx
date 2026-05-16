import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import api from 'mastodon/api';
import Column from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { planetIcon, planetName, spaceColor } from 'mastodon/planets';

import { QuestionsTabNav } from './components/questions_tab_nav';
import type { Question } from './types';

const messages = defineMessages({
  title: { id: 'questions.answers_title', defaultMessage: 'Answers' },
  empty: {
    id: 'questions.answers_empty',
    defaultMessage: 'No answers yet.',
  },
});

const stripHtml = (html: string) => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || '';
};

const AnswersPage: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const [answers, setAnswers] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnswers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api().get('/api/v1/questions/answers');
      setAnswers(res.data as Question[]);
    } catch (err) {
      console.error('Failed to fetch answers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAnswers();
  }, [fetchAnswers]);

  return (
    <Column>
      <ColumnHeader
        title={planetName('Questions')}
        icon='saturn'
        iconComponent={planetIcon('Questions')}
        multiColumn={multiColumn}
      />
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <div
        className='questions-page'
        style={
          { '--space-color': spaceColor('Questions') } as React.CSSProperties
        }
      >
        <div className='questions-page__list'>
          {loading && <div className='questions-page__loading' />}
          {!loading && answers.length === 0 && (
            <p className='questions-page__empty'>
              {intl.formatMessage(messages.empty)}
            </p>
          )}
          {answers.map((answer) => (
            <div key={answer.id} className='question-card'>
              <div className='question-card__header'>
                <img
                  className='question-card__avatar'
                  src={answer.account.avatar}
                  alt={answer.account.username}
                />
                <div className='question-card__meta'>
                  <span className='question-card__display-name'>
                    {answer.account.display_name || answer.account.username}
                  </span>
                  <span className='question-card__acct'>
                    {'@'}
                    {answer.account.acct}
                  </span>
                </div>
              </div>
              <p className='question-card__text'>{stripHtml(answer.content)}</p>
            </div>
          ))}
        </div>

        <QuestionsTabNav />
      </div>
    </Column>
  );
};

export default AnswersPage;
