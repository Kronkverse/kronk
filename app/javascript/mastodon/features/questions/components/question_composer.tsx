import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import api from 'mastodon/api';

import type { Question } from '../types';

const messages = defineMessages({
  placeholder: {
    id: 'questions.composer.placeholder',
    defaultMessage: 'What do you want to know?',
  },
});

export const QuestionComposer: React.FC<{
  onCreated: (question: Question) => void;
}> = ({ onCreated }) => {
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
        post_type: 'question',
        visibility: 'public',
      });
      onCreated(res.data as Question);
      setText('');
    } catch (err) {
      console.error('Failed to post question:', err);
    } finally {
      setSubmitting(false);
    }
  }, [text, submitting, onCreated]);

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

  return (
    <div className='questions-composer'>
      <div className='questions-composer__body'>
        <textarea
          className='questions-composer__input'
          placeholder={intl.formatMessage(messages.placeholder)}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          maxLength={140}
          rows={1}
        />
        <button
          className='questions-composer__submit'
          onClick={handleSubmitClick}
          disabled={!text.trim() || submitting}
          aria-label='Ask'
        >
          {'?'}
        </button>
      </div>
    </div>
  );
};
