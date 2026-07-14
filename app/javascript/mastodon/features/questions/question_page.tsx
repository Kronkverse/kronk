import { useCallback, useEffect, useState } from 'react';

import { Helmet } from 'react-helmet';
import { useHistory, useParams } from 'react-router-dom';

import api from 'mastodon/api';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { useKorner } from 'mastodon/hooks/useKorner';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

import { QuestionDetail } from './components/question_detail';
import type { Question } from './types';

const QuestionPage: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const korner = useKorner('kuestions');
  const kornerIcon = useKornerIcon('kuestions');
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void api()
      .get(`/api/v1/questions/${id}`)
      .then((res) => {
        setQuestion(res.data as Question);
      })
      .catch((err: unknown) => {
        console.error('Failed to fetch question:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  const handleBack = useCallback(() => {
    history.push('/questions');
  }, [history]);

  const handleAnswered = useCallback((updated: Question) => {
    setQuestion(updated);
  }, []);

  const header = (
    <ColumnHeader
      title={korner?.name ?? 'Questions'}
      icon='saturn'
      iconComponent={kornerIcon}
      multiColumn={multiColumn}
    />
  );

  if (loading || !question) {
    return (
      <Column>
        {header}
        <div className='questions-page'>
          <div className='questions-page__list'>
            <div className='questions-page__loading' />
          </div>
        </div>
      </Column>
    );
  }

  return (
    <Column>
      {header}
      <Helmet>
        <title>{question.account.display_name} — Ƙuestions</title>
      </Helmet>
      <div className='questions-page'>
        <div className='questions-page__list'>
          <QuestionDetail
            question={question}
            onBack={handleBack}
            onAnswered={handleAnswered}
          />
        </div>
      </div>
    </Column>
  );
};

export default QuestionPage;
