import { useCallback, useState } from 'react';

import { FormattedMessage } from 'react-intl';

import api from 'mastodon/api';

import type { Task } from './proposal_tabs/tab_kontribute';

const SKILL_TAGS = ['code', 'aesthetic', 'governance'] as const;

export const NewTaskForm: React.FC<{
  proposalId: string;
  onCreated: (task: Task) => void;
  onCancel: () => void;
}> = ({ proposalId, onCreated, onCancel }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [skillTag, setSkillTag] = useState('');
  const [effortEstimate, setEffortEstimate] = useState('');
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
            skill_tag: skillTag || null,
            effort_estimate: effortEstimate ? Number(effortEstimate) : null,
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
    [proposalId, title, description, skillTag, effortEstimate, onCreated],
  );

  const handleFormSubmit = useCallback(
    (e: React.FormEvent) => {
      void handleSubmit(e);
    },
    [handleSubmit],
  );

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => { setTitle(e.target.value); },
    [],
  );

  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) =>
      { setDescription(e.target.value); },
    [],
  );

  const handleSkillChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => { setSkillTag(e.target.value); },
    [],
  );

  const handleEffortChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      { setEffortEstimate(e.target.value); },
    [],
  );

  return (
    <form
      className='governance-form governance-form--inline'
      onSubmit={handleFormSubmit}
    >
      {error && <p className='governance-form__error'>{error}</p>}

      <label className='governance-form__label'>
        <span className='governance-form__label-text'>
          <FormattedMessage
            id='governance.task_form.title'
            defaultMessage='Title'
          />
          <span className='governance-form__required' aria-hidden='true'>
            *
          </span>
        </span>
        <input
          className='governance-form__input'
          type='text'
          value={title}
          onChange={handleTitleChange}
          maxLength={240}
          required
        />
      </label>

      <label className='governance-form__label'>
        <span className='governance-form__label-text'>
          <FormattedMessage
            id='governance.task_form.description'
            defaultMessage='Description'
          />
        </span>
        <textarea
          className='governance-form__textarea'
          value={description}
          onChange={handleDescriptionChange}
          rows={3}
        />
      </label>

      <div className='governance-form__row'>
        <label className='governance-form__label'>
          <span className='governance-form__label-text'>
            <FormattedMessage
              id='governance.task_form.skill'
              defaultMessage='Skill'
            />
          </span>
          <select
            className='governance-form__select'
            value={skillTag}
            onChange={handleSkillChange}
          >
            <option value=''>—</option>
            {SKILL_TAGS.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label className='governance-form__label'>
          <span className='governance-form__label-text'>
            <FormattedMessage
              id='governance.task_form.effort'
              defaultMessage='Effort (hours)'
            />
          </span>
          <input
            className='governance-form__input'
            type='number'
            min='0'
            step='0.5'
            value={effortEstimate}
            onChange={handleEffortChange}
          />
        </label>
      </div>

      <div className='governance-form__actions'>
        <button
          type='button'
          className='governance-form__cancel-btn'
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
          className='governance-form__submit-btn'
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
