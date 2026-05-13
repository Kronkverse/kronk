import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import api from 'mastodon/api';
import Column from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { planetIcon, planetName, spaceColor } from 'mastodon/planets';

import { QuestionCard } from './components/question_card';
import { QuestionComposer } from './components/question_composer';
import { QuestionDetail } from './components/question_detail';
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
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(
    null,
  );
  const listRef = useRef<HTMLDivElement>(null);

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
  }, []);

  const handleScrollToList = useCallback(() => {
    listRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleSelect = useCallback(
    (id: string) => {
      const q = questions.find((question) => question.id === id);
      if (q) setSelectedQuestion(q);
    },
    [questions],
  );

  const handleBack = useCallback(() => {
    setSelectedQuestion(null);
  }, []);

  const handleQuestionAnswered = useCallback((updated: Question) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === updated.id ? updated : q)),
    );
    setSelectedQuestion((sel) => (sel?.id === updated.id ? updated : sel));
  }, []);

  const spaceStyle = {
    '--space-color': spaceColor('Questions'),
  } as React.CSSProperties;

  if (selectedQuestion) {
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
        <div className='questions-page' style={spaceStyle}>
          <div className='questions-page__list'>
            <QuestionDetail
              question={selectedQuestion}
              onBack={handleBack}
              onAnswered={handleQuestionAnswered}
            />
          </div>
        </div>
      </Column>
    );
  }

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

      <div className='questions-page' style={spaceStyle}>
        <div className='questions-page__above-fold'>
          <div className='questions-page__hero'>{'Ƙuestions'}</div>
          <QuestionComposer onCreated={handleCreated} />
          <button
            className='questions-page__scroll-cue'
            onClick={handleScrollToList}
            aria-label='Scroll to questions'
          >
            {'↓'}
          </button>
        </div>

        <div className='questions-page__list' ref={listRef}>
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
              onAnswered={handleQuestionAnswered}
            />
          ))}
        </div>
      </div>
    </Column>
  );
};

export default Questions;
