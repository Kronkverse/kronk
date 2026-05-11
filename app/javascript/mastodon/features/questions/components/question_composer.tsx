import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import api from 'mastodon/api';

import type { Question } from '../types';

const messages = defineMessages({
  placeholder: {
    id: 'questions.composer.placeholder',
    defaultMessage: 'What do you want to know?',
  },
  submit: { id: 'questions.composer.submit', defaultMessage: 'Ask' },
  cancel: { id: 'questions.composer.cancel', defaultMessage: 'Cancel' },
});

export const QuestionComposer: React.FC<{
  onCreated: (question: Question) => void;
  onCancel: () => void;
}> = ({ onCreated, onCancel }) => {
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
      <textarea
        className='questions-composer__input'
        placeholder={intl.formatMessage(messages.placeholder)}
        value={text}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        maxLength={500}
        rows={3}
      />
      <div className='questions-composer__footer'>
        <span className='questions-composer__char-count'>
          {500 - text.length}
        </span>
        <div className='questions-composer__actions'>
          <button className='questions-composer__cancel' onClick={onCancel}>
            {intl.formatMessage(messages.cancel)}
          </button>
          <button
            className='questions-composer__submit'
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
