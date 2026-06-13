import { useCallback, useRef, useState } from 'react';

import api from 'mastodon/api';

export const StoryComposerBanner: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleOpen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, []);

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
      await api().post('/api/v1/statuses', {
        status: text.trim(),
        post_type: 'story',
        visibility: 'public',
      });
      setText('');
      setOpen(false);
    } catch (err) {
      console.error('Failed to post story:', err);
    } finally {
      setSubmitting(false);
    }
  }, [text, submitting]);

  const handleSubmitClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      void handleSubmit();
    },
    [handleSubmit],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        void handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleCancel = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(false);
    setText('');
  }, []);

  if (open) {
    return (
      <div className='story-composer-banner story-composer-banner--open'>
        <textarea
          ref={textareaRef}
          className='story-composer-banner__input'
          placeholder='Share a moment from your day…'
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          maxLength={500}
          rows={3}
        />
        <div className='story-composer-banner__actions'>
          <button
            type='button'
            className='story-composer-banner__cancel'
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            type='button'
            className='story-composer-banner__submit'
            onClick={handleSubmitClick}
            disabled={!text.trim() || submitting}
          >
            Share
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type='button'
      className='story-composer-banner'
      onClick={handleOpen}
    >
      <span className='story-composer-banner__prompt'>
        Share a moment from your day…
      </span>
    </button>
  );
};
