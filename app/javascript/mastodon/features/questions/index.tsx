import { useCallback } from 'react';

import { useIntl, defineMessages } from 'react-intl';

import { Helmet } from 'react-helmet';

import Column from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { planetIcon, planetName } from 'mastodon/planets';

import { QuestionComposer } from './components/question_composer';

const messages = defineMessages({
  title: { id: 'questions.title', defaultMessage: '₭uestions' },
});

const Questions: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();

  const handleCreated = useCallback(() => {
    // questions list TBD
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

      <div className='questions-page'>
        <div className='questions-page__hero'>{'₭uestions'}</div>
        <QuestionComposer onCreated={handleCreated} />
      </div>
    </Column>
  );
};

export default Questions;
