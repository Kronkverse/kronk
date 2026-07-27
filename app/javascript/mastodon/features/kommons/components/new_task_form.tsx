import { useCallback, useState } from 'react';

import { FormattedMessage } from 'react-intl';

import api from 'mastodon/api';

import type { Task } from './proposal_tabs/tab_kontribute';

export const NewTaskForm: React.FC<{
  proposalId: string;
  onCreated: (task: Task) => void;
  onCancel: () => void;
}> = ({ proposalId, onCreated, onCancel }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!title.trim()) return;
      setError(null);
      setSubmitting(true);
      try {
        const res = await api().post(`/api/v1/proposals/${proposalId}/tasks`, {
          task: {
            title: title.trim(),
            description: description.trim() || null,
          },
        });
        onCreated(res.data as Task);
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'Failed to create task';
        setError(msg);
        setSubmitting(false);
      }
    },
    [proposalId, title, description, onCreated],
  );

  const handleFormSubmit = useCallback(
    (e: React.FormEvent) => {
      void handleSubmit(e);
    },
    [handleSubmit],
  );

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTitle(e.target.value);
    },
    [],
  );

  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDescription(e.target.value);
    },
    [],
  );

  return (
    <form
      className='kommons-form kommons-form--inline'
      onSubmit={handleFormSubmit}
    >
      {error && <p className='kommons-form__error'>{error}</p>}

      <label className='kommons-form__label'>
        <span className='kommons-form__label-text'>
          <FormattedMessage
            id='governance.task_form.title'
            defaultMessage='Title'
          />
          <span className='kommons-form__required' aria-hidden='true'>
            *
          </span>
        </span>
        <input
          className='kommons-form__input'
          type='text'
          value={title}
          onChange={handleTitleChange}
          maxLength={240}
          required
        />
      </label>

      <label className='kommons-form__label'>
        <span className='kommons-form__label-text'>
          <FormattedMessage
            id='governance.task_form.description'
            defaultMessage='Description'
          />
        </span>
        <textarea
          className='kommons-form__textarea'
          value={description}
          onChange={handleDescriptionChange}
          rows={3}
        />
      </label>

      <div className='kommons-form__actions'>
        <button
          type='button'
          className='kommons-form__cancel-btn'
          onClick={onCancel}
          disabled={submitting}
        >
          <FormattedMessage
            id='governance.form.cancel'
            defaultMessage='Cancel'
          />
        </button>
        <button
          type='submit'
          className='kommons-form__submit-btn'
          disabled={submitting || !title.trim()}
        >
          {submitting ? (
            <FormattedMessage
              id='governance.task_form.creating'
              defaultMessage='Creating…'
            />
          ) : (
            <FormattedMessage
              id='governance.task_form.create'
              defaultMessage='Create task'
            />
          )}
        </button>
      </div>
    </form>
  );
};
