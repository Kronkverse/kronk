import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import api from 'mastodon/api';
import Column from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { planetIcon, planetName, spaceColor } from 'mastodon/planets';

import { QuestionCard } from './components/question_card';
import { QuestionComposer } from './components/question_composer';
import type { Question } from './types';

const messages = defineMessages({
  title: { id: 'questions.title', defaultMessage: 'Ƙuestions' },
  empty: {
    id: 'questions.empty',
    defaultMessage: 'No questions yet. Ask something!',
  },
});

const Questions: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ask' | 'browse'>('ask');

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api().get('/api/v1/questions');
      setQuestions(res.data as Question[]);
    } catch (err) {
      console.error('Failed to fetch questions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchQuestions();
  }, [fetchQuestions]);

  const handleCreated = useCallback((question: Question) => {
    setQuestions((prev) => [question, ...prev]);
    setActiveTab('browse');
  }, []);

  const handleAnswered = useCallback((updated: Question) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === updated.id ? updated : q)),
    );
  }, []);

  const handleTabAsk = useCallback(() => {
    setActiveTab('ask');
  }, []);
  const handleTabBrowse = useCallback(() => {
    setActiveTab('browse');
  }, []);

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
        <div className='questions-tab-nav'>
          <button
            className={`questions-tab-nav__tab ${activeTab === 'ask' ? 'questions-tab-nav__tab--active' : ''}`}
            onClick={handleTabAsk}
          >
            {'Ask'}
          </button>
          <button
            className={`questions-tab-nav__tab ${activeTab === 'browse' ? 'questions-tab-nav__tab--active' : ''}`}
            onClick={handleTabBrowse}
          >
            {'Ƙuestions'}
          </button>
        </div>

        {activeTab === 'ask' && (
          <div className='questions-page__above-fold'>
            <div className='questions-page__hero'>{'Ƙuestions'}</div>
            <QuestionComposer onCreated={handleCreated} />
          </div>
        )}

        {activeTab === 'browse' && (
          <div className='questions-page__list'>
            {loading && <div className='questions-page__loading' />}
            {!loading && questions.length === 0 && (
              <p className='questions-page__empty'>
                {intl.formatMessage(messages.empty)}
              </p>
            )}
            {questions.map((question) => (
              <QuestionCard
                key={question.id}
                question={question}
                onAnswered={handleAnswered}
              />
            ))}
          </div>
        )}
      </div>
    </Column>
  );
};

export default Questions;
