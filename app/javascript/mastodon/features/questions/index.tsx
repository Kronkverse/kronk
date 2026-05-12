import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import api from 'mastodon/api';
import Column from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { planetIcon, planetName } from 'mastodon/planets';

import { QuestionCard } from './components/question_card';
import { QuestionComposer } from './components/question_composer';
import { QuestionDetail } from './components/question_detail';
import type { Question } from './types';

const messages = defineMessages({
  title: { id: 'questions.title', defaultMessage: '₭uestions' },
  empty: {
    id: 'questions.empty',
    defaultMessage: 'No questions yet. Ask something!',
  },
});

const Questions: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [answeringId, setAnsweringId] = useState<string | null>(null);

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
    setSelectedId(question.id);
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setAnsweringId(null);
  }, []);

  const handleAnswer = useCallback((id: string) => {
    setSelectedId(id);
    setAnsweringId(id);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedId(null);
    setAnsweringId(null);
  }, []);

  const handleAnswered = useCallback((updated: Question) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === updated.id ? updated : q)),
    );
  }, []);

  const selectedQuestion = questions.find((q) => q.id === selectedId) ?? null;

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

      <div className='questions-page'>
        {selectedQuestion ? (
          <QuestionDetail
            question={selectedQuestion}
            onBack={handleBack}
            onAnswered={handleAnswered}
            initiallyAnswering={answeringId === selectedQuestion.id}
          />
        ) : (
          <>
            <div className='questions-page__hero'>{'?'}</div>

            <QuestionComposer onCreated={handleCreated} />

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
                onSelect={handleSelect}
                onAnswer={handleAnswer}
              />
            ))}
          </>
        )}
      </div>
    </Column>
  );
};

export default Questions;
