import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import QuestionMarkIcon from '@/material-icons/400-24px/question_mark.svg?react';
import api from 'mastodon/api';
import Column from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { Icon } from 'mastodon/components/icon';

import { QuestionCard } from './components/question_card';
import { QuestionComposer } from './components/question_composer';
import { QuestionDetail } from './components/question_detail';
import type { Question } from './types';

const messages = defineMessages({
  title: { id: 'questions.title', defaultMessage: '₭uestions' },
  description: {
    id: 'questions.description',
    defaultMessage:
      'Ask the Kronk community anything. Questions are answered publicly and build shared knowledge.',
  },
  empty: {
    id: 'questions.empty',
    defaultMessage: 'No questions yet. Ask something!',
  },
  askQuestion: {
    id: 'questions.ask',
    defaultMessage: 'Ask a question',
  },
});

const Questions: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
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
    setShowComposer(false);
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

  const handleShowComposer = useCallback(() => {
    setShowComposer(true);
  }, []);

  const handleHideComposer = useCallback(() => {
    setShowComposer(false);
  }, []);

  const selectedQuestion = questions.find((q) => q.id === selectedId) ?? null;

  return (
    <Column>
      <ColumnHeader
        title={intl.formatMessage(messages.title)}
        icon='question_mark'
        iconComponent={QuestionMarkIcon}
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
            <section className='questions-page__hero'>
              <h1 className='questions-page__hero-title'>
                {intl.formatMessage(messages.title)}
              </h1>
              <p className='questions-page__hero-intro'>
                {intl.formatMessage(messages.description)}
              </p>
            </section>

            {showComposer && (
              <QuestionComposer
                onCreated={handleCreated}
                onCancel={handleHideComposer}
              />
            )}

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

            <button
              className='questions-page__fab'
              onClick={handleShowComposer}
              title={intl.formatMessage(messages.askQuestion)}
            >
              <Icon id='add' icon={AddIcon} />
            </button>
          </>
        )}
      </div>
    </Column>
  );
};

export default Questions;
