import { useCallback } from 'react';

import { useHistory, useRouteMatch } from 'react-router-dom';

export const QuestionsTabNav: React.FC = () => {
  const history = useHistory();
  const onAnswers = useRouteMatch('/questions/answers');

  const goQuestions = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      history.push('/questions');
    },
    [history],
  );

  const goAnswers = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      history.push('/questions/answers');
    },
    [history],
  );

  return (
    <div className='questions-tab-nav'>
      <button
        className={`questions-tab-nav__tab ${!onAnswers ? 'questions-tab-nav__tab--active' : ''}`}
        onClick={goQuestions}
      >
        Ƙuestions
      </button>
      <button
        className={`questions-tab-nav__tab ${onAnswers ? 'questions-tab-nav__tab--active' : ''}`}
        onClick={goAnswers}
      >
        Answers
      </button>
    </div>
  );
};
