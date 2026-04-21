import { useEffect, useState } from 'react';

import { FormattedMessage } from 'react-intl';

import api from 'mastodon/api';

import { TaskCard } from '../task_card';
import { BudgetItemRow } from '../budget_item_row';

export type Task = {
  id: string;
  proposal_id: string;
  title: string;
  description: string | null;
  status: string;
  skill_tag: string | null;
  effort_estimate: number | null;
  created_at: string;
  assigned_to_account?: { id: string; username: string; display_name: string; avatar: string };
};

export type BudgetItem = {
  id: string;
  proposal_id: string;
  description: string;
  cost_estimate: number;
  currency: string;
  status: string;
};

const STATUS_ORDER = ['open', 'in_progress', 'done'] as const;

export const TabPlan: React.FC<{ proposalId: string }> = ({ proposalId }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [tasksRes, budgetRes] = await Promise.all([
          api().get(`/api/v1/proposals/${proposalId}/tasks`),
          api().get(`/api/v1/proposals/${proposalId}/budget_items`),
        ]);
        setTasks(tasksRes.data as Task[]);
        setBudgetItems(budgetRes.data as BudgetItem[]);
      } catch (err) {
        console.error('Failed to load plan:', err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [proposalId]);

  if (loading) {
    return (
      <div className='governance-tab-plan__loading'>
        <FormattedMessage id='governance.loading' defaultMessage='Loading proposals…' />
      </div>
    );
  }

  const tasksByStatus = STATUS_ORDER.reduce<Record<string, Task[]>>((acc, status) => {
    acc[status] = tasks.filter((t) => t.status === status);
    return acc;
  }, {});

  const budgetTotal = budgetItems.reduce((sum, item) => sum + (item.cost_estimate ?? 0), 0);
  const currency = budgetItems[0]?.currency ?? 'NZD';

  return (
    <div className='governance-tab-plan'>
      <section className='governance-tab-plan__tasks'>
        <h4 className='governance-tab-plan__section-heading'>
          <FormattedMessage id='governance.plan.tasks' defaultMessage='Tasks' />
        </h4>

        {tasks.length === 0 && (
          <p className='governance-tab-plan__empty'>
            <FormattedMessage id='governance.plan.no_tasks' defaultMessage='No tasks defined yet.' />
          </p>
        )}

        {STATUS_ORDER.map((status) => {
          const statusTasks = tasksByStatus[status] ?? [];
          return statusTasks.length > 0 ? (
            <div key={status} className='governance-tab-plan__task-group'>
              <h5 className={`governance-tab-plan__status-label governance-tab-plan__status-label--${status}`}>
                {status === 'open' && <FormattedMessage id='governance.task.open' defaultMessage='Open' />}
                {status === 'in_progress' && <FormattedMessage id='governance.task.in_progress' defaultMessage='In Progress' />}
                {status === 'done' && <FormattedMessage id='governance.task.done' defaultMessage='Done' />}
              </h5>
              {statusTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          ) : null;
        })}
      </section>

      {budgetItems.length > 0 && (
        <section className='governance-tab-plan__budget'>
          <h4 className='governance-tab-plan__section-heading'>
            <FormattedMessage id='governance.plan.budget' defaultMessage='Budget' />
          </h4>
          <table className='governance-budget-table'>
            <thead>
              <tr>
                <th><FormattedMessage id='governance.budget.description' defaultMessage='Description' /></th>
                <th><FormattedMessage id='governance.budget.estimate' defaultMessage='Estimate' /></th>
                <th><FormattedMessage id='governance.budget.status' defaultMessage='Status' /></th>
              </tr>
            </thead>
            <tbody>
              {budgetItems.map((item) => (
                <BudgetItemRow key={item.id} item={item} />
              ))}
            </tbody>
            <tfoot>
              <tr className='governance-budget-table__total'>
                <td><FormattedMessage id='governance.budget.total' defaultMessage='Total' /></td>
                <td>{currency} {budgetTotal.toFixed(2)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </section>
      )}
    </div>
  );
};
