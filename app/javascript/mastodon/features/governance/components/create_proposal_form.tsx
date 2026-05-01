import { useCallback, useState } from 'react';

import { FormattedMessage } from 'react-intl';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import api from 'mastodon/api';
import { Icon } from 'mastodon/components/icon';

import type { Proposal } from '../types';

interface TaskRow {
  title: string;
  description: string;
}

const TITLE_MAX = 240;

const emptyTask = (): TaskRow => ({ title: '', description: '' });

type Step = 'idle' | 'proposal' | 'tasks';

export const CreateProposalForm: React.FC<{
  onCreated: (proposal: Proposal) => void;
  onCancel: () => void;
}> = ({ onCreated, onCancel }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [taskRows, setTaskRows] = useState<TaskRow[]>([emptyTask()]);
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState<string | null>(null);
  const submitting = step !== 'idle';

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setStep('proposal');
      try {
        const proposalRes = await api().post('/api/v1/proposals', {
          proposal: { title, body },
        });
        const proposal = proposalRes.data as Proposal;

        const filledTasks = taskRows.filter((t) => t.title.trim());

        if (filledTasks.length) {
          setStep('tasks');
          await Promise.all(
            filledTasks.map((t) =>
              api().post(`/api/v1/proposals/${proposal.id}/tasks`, {
                task: {
                  title: t.title,
                  description: t.description || null,
                },
              }),
            ),
          );
        }
        onCreated(proposal);
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'Failed to create proposal';
        setError(msg);
        setStep('idle');
      }
    },
    [title, body, taskRows, onCreated],
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

  const handleBodyChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setBody(e.target.value);
    },
    [],
  );

  const handleAddTask = useCallback(() => {
    setTaskRows((prev) => [...prev, emptyTask()]);
  }, []);

  const updateTask = useCallback(
    (i: number, field: keyof TaskRow, value: string) => {
      setTaskRows((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)),
      );
    },
    [],
  );

  const removeTaskAt = useCallback((i: number) => {
    setTaskRows((prev) => prev.filter((_, idx) => idx !== i));
  }, []);

  const handleTaskTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateTask(Number(e.currentTarget.dataset.idx), 'title', e.target.value);
    },
    [updateTask],
  );

  const handleTaskDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateTask(
        Number(e.currentTarget.dataset.idx),
        'description',
        e.target.value,
      );
    },
    [updateTask],
  );

  const handleTaskRemove = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      removeTaskAt(Number(e.currentTarget.dataset.idx));
    },
    [removeTaskAt],
  );

  return (
    <form className='governance-form' onSubmit={handleFormSubmit}>
      <h3 className='governance-form__heading'>
        <FormattedMessage
          id='governance.new_proposal'
          defaultMessage='Plant a seed'
        />
      </h3>

      {error && <p className='governance-form__error'>{error}</p>}

      <section className='governance-form__section'>
        <h4 className='governance-form__section-heading'>
          <FormattedMessage
            id='governance.form.proposal'
            defaultMessage='Seed'
          />
        </h4>

        <label className='governance-form__label'>
          <span className='governance-form__label-text'>
            <FormattedMessage
              id='governance.form.title'
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
            maxLength={TITLE_MAX}
            required
          />
          <span className='governance-form__hint-row'>
            <small className='governance-form__hint'>
              <FormattedMessage
                id='governance.form.title_hint'
                defaultMessage='A short, descriptive name.'
              />
            </small>
            <small className='governance-form__counter'>
              {title.length} / {TITLE_MAX}
            </small>
          </span>
        </label>

        <label className='governance-form__label'>
          <span className='governance-form__label-text'>
            <FormattedMessage
              id='governance.form.body'
              defaultMessage='Description'
            />
            <span className='governance-form__required' aria-hidden='true'>
              *
            </span>
          </span>
          <textarea
            className='governance-form__textarea'
            value={body}
            onChange={handleBodyChange}
            rows={6}
            required
          />
          <small className='governance-form__hint'>
            <FormattedMessage
              id='governance.form.body_hint'
              defaultMessage='Describe the seed, the rationale, and expected impact.'
            />
          </small>
        </label>
      </section>

      <section className='governance-form__section'>
        <h4 className='governance-form__section-heading'>
          <FormattedMessage
            id='governance.form.tasks'
            defaultMessage='Implementation tasks'
          />
        </h4>
        <small className='governance-form__hint'>
          <FormattedMessage
            id='governance.form.tasks_hint'
            defaultMessage='Optional. Break the seed into work units.'
          />
        </small>

        {taskRows.map((row, i) => (
          <div
            key={i}
            className='governance-form__task-row governance-form__task-row--stacked'
          >
            <div className='governance-form__task-row-main'>
              <input
                className='governance-form__input'
                type='text'
                placeholder='Task title'
                value={row.title}
                data-idx={i}
                onChange={handleTaskTitleChange}
              />
              <button
                type='button'
                className='governance-form__remove-btn'
                data-idx={i}
                onClick={handleTaskRemove}
                aria-label='Remove task'
              >
                <Icon id='close' icon={CloseIcon} />
              </button>
            </div>
            <textarea
              className='governance-form__textarea governance-form__textarea--task'
              placeholder='Task description (optional)'
              value={row.description}
              data-idx={i}
              onChange={handleTaskDescriptionChange}
              rows={2}
            />
          </div>
        ))}

        <button
          type='button'
          className='governance-form__add-btn'
          onClick={handleAddTask}
        >
          <Icon id='add' icon={AddIcon} />
          <FormattedMessage
            id='governance.form.add_task'
            defaultMessage='Add task'
          />
        </button>
      </section>

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
          disabled={submitting}
        >
          {step === 'proposal' && (
            <FormattedMessage
              id='governance.form.step_proposal'
              defaultMessage='Planting seed…'
            />
          )}
          {step === 'tasks' && (
            <FormattedMessage
              id='governance.form.step_tasks'
              defaultMessage='Adding tasks…'
            />
          )}
          {step === 'idle' && (
            <FormattedMessage
              id='governance.form.submit'
              defaultMessage='Plant seed'
            />
          )}
        </button>
      </div>
    </form>
  );
};
