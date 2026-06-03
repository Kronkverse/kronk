import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import api from 'mastodon/api';

import type { Answer, Question } from '../types';

const messages = defineMessages({
  placeholder: {
    id: 'questions.answer_composer.placeholder',
    defaultMessage: 'Share your answer…',
  },
  submit: { id: 'questions.answer_composer.submit', defaultMessage: 'Answer' },
  cancel: { id: 'questions.answer_composer.cancel', defaultMessage: 'Cancel' },
});

const parseContent = (html: string) => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || '';
};

export const AnswerComposer: React.FC<{
  question: Question;
  onAnswered: (answer: Answer) => void;
  onCancel: () => void;
}> = ({ question, onAnswered, onCancel }) => {
  const intl = useIntl();
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
    },
    [],
  );

  const handleSubmit = useCallback(async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await api().post('/api/v1/statuses', {
        status: text.trim(),
        post_type: 'answer',
        in_reply_to_id: question.id,
        visibility: 'public',
      });
      onAnswered(res.data as Answer);
      setText('');
    } catch (err) {
      console.error('Failed to post answer:', err);
    } finally {
      setSubmitting(false);
    }
  }, [text, submitting, question.id, onAnswered]);

  const handleSubmitClick = useCallback(() => {
    void handleSubmit();
  }, [handleSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        void handleSubmit();
      }
    },
    [handleSubmit],
  );

  const questionText = parseContent(question.content);

  return (
    <div className='answer-composer'>
      <div className='answer-composer__question-preview'>
        <span className='answer-composer__question-label'>Q</span>
        <p className='answer-composer__question-text'>{questionText}</p>
      </div>

      <textarea
        className='answer-composer__input'
        placeholder={intl.formatMessage(messages.placeholder)}
        value={text}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        maxLength={5000}
        rows={4}
      />

      <div className='answer-composer__footer'>
        <span className='answer-composer__char-count'>
          {5000 - text.length}
        </span>
        <div className='answer-composer__actions'>
          <button className='answer-composer__cancel' onClick={onCancel}>
            {intl.formatMessage(messages.cancel)}
          </button>
          <button
            className='answer-composer__submit'
            onClick={handleSubmitClick}
            disabled={!text.trim() || submitting}
          >
            {intl.formatMessage(messages.submit)}
          </button>
        </div>
      </div>
    </div>
  );
};
