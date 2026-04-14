import { useState, useCallback } from 'react';

import { FormattedMessage } from 'react-intl';

import AddIcon from '@/material-icons/400-24px/add.svg?react';

import { Icon } from 'mastodon/components/icon';
import api from 'mastodon/api';

import type { Proposal } from '../index';

type TaskRow = { title: string; skill_tag: string; effort_estimate: string };
type BudgetRow = { description: string; cost_estimate: string; currency: string };

const SKILL_TAGS = ['dev', 'design', 'moderation', 'writing', 'ops'];
const CURRENCIES = ['NZD', 'USD', 'EUR', 'AUD', 'GBP'];

const emptyTask = (): TaskRow => ({ title: '', skill_tag: '', effort_estimate: '' });
const emptyBudget = (): BudgetRow => ({ description: '', cost_estimate: '', currency: 'NZD' });

export const CreateProposalForm: React.FC<{
  onCreated: (proposal: Proposal) => void;
  onCancel: () => void;
}> = ({ onCreated, onCancel }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [taskRows, setTaskRows] = useState<TaskRow[]>([emptyTask()]);
  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>([emptyBudget()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      setError(null);
      try {
        const proposalRes = await api().post('/api/v1/proposals', {
          proposal: {
            title,
            body,
            closes_at: closesAt || null,
          },
        });
        const proposal = proposalRes.data as Proposal;

        const filledTasks = taskRows.filter((t) => t.title.trim());
        const filledBudget = budgetRows.filter((b) => b.description.trim());

        await Promise.all([
          ...filledTasks.map((t) =>
            api().post(`/api/v1/proposals/${proposal.id}/tasks`, {
              task: {
                title: t.title,
                skill_tag: t.skill_tag || null,
                effort_estimate: t.effort_estimate ? parseInt(t.effort_estimate, 10) : null,
              },
            }),
          ),
          ...filledBudget.map((b) =>
            api().post(`/api/v1/proposals/${proposal.id}/budget_items`, {
              budget_item: {
                description: b.description,
                cost_estimate: b.cost_estimate ? parseFloat(b.cost_estimate) : null,
                currency: b.currency,
              },
            }),
          ),
        ]);

        onCreated(proposal);
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'Failed to create proposal';
        setError(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [title, body, closesAt, taskRows, budgetRows, onCreated],
  );

  const updateTask = (i: number, field: keyof TaskRow, value: string) => {
    setTaskRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  };

  const updateBudget = (i: number, field: keyof BudgetRow, value: string) => {
    setBudgetRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  };

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
          <FormattedMessage id='governance.form.title' defaultMessage='Title' />
          <input
            className='governance-form__input'
            type='text'
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={240}
            required
          />
        </label>

        <label className='governance-form__label'>
          <FormattedMessage id='governance.form.body' defaultMessage='Body' />
          <textarea
            className='governance-form__textarea'
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            required
          />
        </label>

        <label className='governance-form__label'>
          <FormattedMessage id='governance.form.closes_at' defaultMessage='Closes at' />
          <input
            className='governance-form__input'
            type='datetime-local'
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
          />
        </label>
      </section>

      <section className='governance-form__section'>
        <h4 className='governance-form__section-heading'>
          <FormattedMessage id='governance.form.tasks' defaultMessage='Implementation tasks' />
        </h4>

        {taskRows.map((row, i) => (
          <div key={i} className='governance-form__task-row'>
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
              <option value=''>Skill tag</option>
              {SKILL_TAGS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <input
              className='governance-form__input governance-form__input--narrow'
              type='number'
              min={0}
              placeholder='Hours'
              value={row.effort_estimate}
              onChange={(e) => updateTask(i, 'effort_estimate', e.target.value)}
            />
          </div>
        ))}

        <button
          type='button'
          className='governance-form__add-btn'
          onClick={() => setTaskRows((prev) => [...prev, emptyTask()])}
        >
          <Icon id='add' icon={AddIcon} />
          <FormattedMessage id='governance.form.add_task' defaultMessage='+ Add task' />
        </button>
      </section>

      <section className='governance-form__section'>
        <h4 className='governance-form__section-heading'>
          <FormattedMessage id='governance.form.budget' defaultMessage='Budget' />
        </h4>

        {budgetRows.map((row, i) => (
          <div key={i} className='governance-form__budget-row'>
            <input
              className='governance-form__input'
              type='text'
              placeholder='Description'
              value={row.description}
              onChange={(e) => updateBudget(i, 'description', e.target.value)}
            />
            <input
              className='governance-form__input governance-form__input--narrow'
              type='number'
              min={0}
              step='0.01'
              placeholder='Amount'
              value={row.cost_estimate}
              onChange={(e) => updateBudget(i, 'cost_estimate', e.target.value)}
            />
            <select
              className='governance-form__select'
              value={row.currency}
              onChange={(e) => updateBudget(i, 'currency', e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        ))}

        <button
          type='button'
          className='governance-form__add-btn'
          onClick={() => setBudgetRows((prev) => [...prev, emptyBudget()])}
        >
          <Icon id='add' icon={AddIcon} />
          <FormattedMessage id='governance.form.add_budget_item' defaultMessage='+ Add item' />
        </button>
      </section>

      <div className='governance-form__actions'>
        <button type='button' className='governance-form__cancel-btn' onClick={onCancel}>
          <FormattedMessage id='governance.form.cancel' defaultMessage='Cancel' />
        </button>
        <button type='submit' className='governance-form__submit-btn' disabled={submitting}>
          {submitting ? (
            <FormattedMessage id='governance.form.submitting' defaultMessage='Creating…' />
          ) : (
            <FormattedMessage id='governance.form.submit' defaultMessage='Create proposal' />
          )}
        </button>
      </div>
    </form>
  );
};
