import { useState, useCallback } from 'react';

import { FormattedMessage } from 'react-intl';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';

import { Icon } from 'mastodon/components/icon';
import api from 'mastodon/api';

import type { Proposal } from '../index';

type TaskRow = { title: string; description: string; skill_tag: string };

const SKILL_TAGS = ['code', 'aesthetic', 'governance'] as const;
const PROPOSAL_TYPES = ['small', 'medium', 'large'] as const;
const CATEGORY_VALUES = [
  'timeline', 'huddle', 'events', 'marketplace', 'identity',
  'moderation', 'infrastructure', 'app', 'design', 'governance',
] as const;
const TITLE_MAX = 240;
type ProposalType = (typeof PROPOSAL_TYPES)[number];

const emptyTask = (): TaskRow => ({ title: '', description: '', skill_tag: '' });

type Step = 'idle' | 'proposal' | 'tasks';

export const CreateProposalForm: React.FC<{
  onCreated: (proposal: Proposal) => void;
  onCancel: () => void;
}> = ({ onCreated, onCancel }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [proposalType, setProposalType] = useState<ProposalType>('small');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
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
          proposal: {
            title,
            body,
            proposal_type: proposalType,
            categories: selectedCategories,
          },
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
                  skill_tag: t.skill_tag || null,
                },
              }),
            ),
          );
        }
        onCreated(proposal);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to create proposal';
        setError(msg);
        setStep('idle');
      }
    },
    [title, body, proposalType, selectedCategories, taskRows, onCreated],
  );

  const updateTask = (i: number, field: keyof TaskRow, value: string) => {
    setTaskRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  };
  const removeTask = (i: number) => setTaskRows((prev) => prev.filter((_, idx) => idx !== i));
  const toggleCategory = (cat: string) =>
    setSelectedCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));

  return (
    <form className='governance-form' onSubmit={(e) => void handleSubmit(e)}>
      <h3 className='governance-form__heading'>
        <FormattedMessage id='governance.new_proposal' defaultMessage='New Proposal' />
      </h3>

      {error && <p className='governance-form__error'>{error}</p>}

      <section className='governance-form__section'>
        <h4 className='governance-form__section-heading'>
          <FormattedMessage id='governance.form.proposal' defaultMessage='Proposal' />
        </h4>

        <label className='governance-form__label'>
          <span className='governance-form__label-text'>
            <FormattedMessage id='governance.form.title' defaultMessage='Title' />
            <span className='governance-form__required' aria-hidden='true'>*</span>
          </span>
          <input
            className='governance-form__input'
            type='text'
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={TITLE_MAX}
            required
          />
          <span className='governance-form__hint-row'>
            <small className='governance-form__hint'>
              <FormattedMessage id='governance.form.title_hint' defaultMessage='A short, descriptive name.' />
            </small>
            <small className='governance-form__counter'>{title.length} / {TITLE_MAX}</small>
          </span>
        </label>

        <label className='governance-form__label'>
          <span className='governance-form__label-text'>
            <FormattedMessage id='governance.form.body' defaultMessage='Description' />
            <span className='governance-form__required' aria-hidden='true'>*</span>
          </span>
          <textarea
            className='governance-form__textarea'
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            required
          />
          <small className='governance-form__hint'>
            <FormattedMessage
              id='governance.form.body_hint'
              defaultMessage='Describe the proposal, the rationale, and expected impact.'
            />
          </small>
        </label>

        <label className='governance-form__label'>
          <span className='governance-form__label-text'>
            <FormattedMessage id='governance.form.proposal_type' defaultMessage='Size' />
          </span>
          <select
            className='governance-form__select'
            value={proposalType}
            onChange={(e) => setProposalType(e.target.value as ProposalType)}
          >
            {PROPOSAL_TYPES.map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
          <small className='governance-form__hint'>
            <FormattedMessage
              id='governance.form.proposal_type_hint'
              defaultMessage='Rough scope: Small (a few hours), Medium (a few days), Large (weeks of work).'
            />
          </small>
        </label>

        <div className='governance-form__label'>
          <span className='governance-form__label-text'>
            <FormattedMessage id='governance.form.categories' defaultMessage='Categories' />
          </span>
          <div className='governance-form__category-chips'>
            {CATEGORY_VALUES.map((cat) => (
              <button
                key={cat}
                type='button'
                className={`governance-form__category-chip ${selectedCategories.includes(cat) ? 'active' : ''}`}
                onClick={() => toggleCategory(cat)}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
          <small className='governance-form__hint'>
            <FormattedMessage
              id='governance.form.categories_hint'
              defaultMessage='Pick the Kronk spaces this touches. Used for filtering.'
            />
          </small>
        </div>
      </section>

      <section className='governance-form__section'>
        <h4 className='governance-form__section-heading'>
          <FormattedMessage id='governance.form.tasks' defaultMessage='Implementation tasks' />
        </h4>
        <small className='governance-form__hint'>
          <FormattedMessage
            id='governance.form.tasks_hint'
            defaultMessage='Optional. Break the proposal into work units.'
          />
        </small>

        {taskRows.map((row, i) => (
          <div key={i} className='governance-form__task-row governance-form__task-row--stacked'>
            <div className='governance-form__task-row-main'>
              <input
                className='governance-form__input'
                type='text'
                placeholder='Task title'
                value={row.title}
                onChange={(e) => updateTask(i, 'title', e.target.value)}
              />
              <select
                className='governance-form__select'
                value={row.skill_tag}
                onChange={(e) => updateTask(i, 'skill_tag', e.target.value)}
              >
                <option value=''>Skill</option>
                {SKILL_TAGS.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
              <button
                type='button'
                className='governance-form__remove-btn'
                onClick={() => removeTask(i)}
                aria-label='Remove task'
              >
                <Icon id='close' icon={CloseIcon} />
              </button>
            </div>
            <textarea
              className='governance-form__textarea governance-form__textarea--task'
              placeholder='Task description (optional)'
              value={row.description}
              onChange={(e) => updateTask(i, 'description', e.target.value)}
              rows={2}
            />
          </div>
        ))}

        <button
          type='button'
          className='governance-form__add-btn'
          onClick={() => setTaskRows((prev) => [...prev, emptyTask()])}
        >
          <Icon id='add' icon={AddIcon} />
          <FormattedMessage id='governance.form.add_task' defaultMessage='Add task' />
        </button>
      </section>

      <div className='governance-form__actions'>
        <button
          type='button'
          className='governance-form__cancel-btn'
          onClick={onCancel}
          disabled={submitting}
        >
          <FormattedMessage id='governance.form.cancel' defaultMessage='Cancel' />
        </button>
        <button type='submit' className='governance-form__submit-btn' disabled={submitting}>
          {step === 'proposal' && (
            <FormattedMessage id='governance.form.step_proposal' defaultMessage='Creating proposal…' />
          )}
          {step === 'tasks' && (
            <FormattedMessage id='governance.form.step_tasks' defaultMessage='Adding tasks…' />
          )}
          {step === 'idle' && (
            <FormattedMessage id='governance.form.submit' defaultMessage='Create proposal' />
          )}
        </button>
      </div>
    </form>
  );
};
