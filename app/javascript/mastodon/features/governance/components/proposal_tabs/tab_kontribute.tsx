import { useCallback, useEffect, useState } from 'react';

import { FormattedMessage } from 'react-intl';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import api from 'mastodon/api';
import { Icon } from 'mastodon/components/icon';
import { me } from 'mastodon/initial_state';

import { BudgetItemRow } from '../budget_item_row';
import { NewTaskForm } from '../new_task_form';
import { TaskCard } from '../task_card';

export interface Task {
  id: string;
  proposal_id: string;
  title: string;
  description: string | null;
  status: string;
  skill_tag: string | null;
  effort_estimate: number | null;
  created_at: string;
  assigned_to_account?: {
    id: string;
    username: string;
    display_name: string;
    avatar: string;
  };
}

export interface BudgetItem {
  id: string;
  proposal_id: string;
  description: string;
  cost_estimate: number;
  currency: string;
  status: string;
}

const STATUS_ORDER = ['open', 'in_progress', 'done'] as const;

export const TabKontribute: React.FC<{ proposalId: string }> = ({
  proposalId,
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Settled, not all: budget_items has a controller but no route, so
        // that request 404s. Under Promise.all the rejection took the whole
        // tab down with it — setTasks never ran and Kontribute rendered
        // empty for every proposal, hiding a working tasks API.
        const [tasksRes, budgetRes] = await Promise.allSettled([
          api().get(`/api/v1/proposals/${proposalId}/tasks`),
          api().get(`/api/v1/proposals/${proposalId}/budget_items`),
        ]);

        if (tasksRes.status === 'fulfilled') {
          setTasks(tasksRes.value.data as Task[]);
        } else {
          console.error('Failed to load tasks:', tasksRes.reason);
        }

        if (budgetRes.status === 'fulfilled') {
          setBudgetItems(budgetRes.value.data as BudgetItem[]);
        }
      } catch (err) {
        console.error('Failed to load Kontribute tab:', err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [proposalId]);

  const handleTaskCreated = useCallback((task: Task) => {
    setTasks((prev) => [...prev, task]);
    setShowNewTaskForm(false);
  }, []);

  const handleClaim = useCallback(async (taskId: string) => {
    if (!me) return;
    setClaiming(taskId);
    try {
      const res = await api().patch(`/api/v1/tasks/${taskId}`, {
        task: { status: 'in_progress', assigned_to_account_id: me },
      });
      const updated = res.data as Task;
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    } catch (err) {
      console.error('Failed to claim task:', err);
    } finally {
      setClaiming(null);
    }
  }, []);

  const handleClaimClick = useCallback(
    (taskId: string) => {
      void handleClaim(taskId);
    },
    [handleClaim],
  );

  const handleShowNewTask = useCallback(() => {
    setShowNewTaskForm(true);
  }, []);
  const handleHideNewTask = useCallback(() => {
    setShowNewTaskForm(false);
  }, []);

  if (loading) {
    return (
      <div className='governance-tab-kontribute__loading'>
        <FormattedMessage
          id='governance.kontribute.loading'
          defaultMessage='Loading…'
        />
      </div>
    );
  }

  const tasksByStatus = STATUS_ORDER.reduce<Record<string, Task[]>>(
    (acc, status) => {
      acc[status] = tasks.filter((t) => t.status === status);
      return acc;
    },
    {},
  );

  const budgetTotal = budgetItems.reduce(
    (sum, item) => sum + item.cost_estimate,
    0,
  );
  const currency = budgetItems[0]?.currency ?? 'NZD';

  return (
    <div className='governance-tab-kontribute'>
      <section className='governance-tab-kontribute__tasks'>
        <div className='governance-tab-kontribute__section-header'>
          <h4 className='governance-tab-kontribute__section-heading'>
            <FormattedMessage
              id='governance.kontribute.tasks'
              defaultMessage='Tasks'
            />
          </h4>
          {!showNewTaskForm && (
            <button
              type='button'
              className='governance-tab-kontribute__new-btn'
              onClick={handleShowNewTask}
            >
              <Icon id='add' icon={AddIcon} />
              <FormattedMessage
                id='governance.kontribute.new_task'
                defaultMessage='New task'
              />
            </button>
          )}
        </div>

        {showNewTaskForm && (
          <NewTaskForm
            proposalId={proposalId}
            onCreated={handleTaskCreated}
            onCancel={handleHideNewTask}
          />
        )}

        {tasks.length === 0 && !showNewTaskForm && (
          <p className='governance-tab-kontribute__empty'>
            <FormattedMessage
              id='governance.kontribute.no_tasks'
              defaultMessage='No tasks defined yet.'
            />
          </p>
        )}

        {STATUS_ORDER.map((status) => {
          const statusTasks = tasksByStatus[status] ?? [];
          return statusTasks.length > 0 ? (
            <div key={status} className='governance-tab-kontribute__task-group'>
              <h5
                className={`governance-tab-kontribute__status-label governance-tab-kontribute__status-label--${status}`}
              >
                {status === 'open' && (
                  <FormattedMessage
                    id='governance.task.open'
                    defaultMessage='Open'
                  />
                )}
                {status === 'in_progress' && (
                  <FormattedMessage
                    id='governance.task.in_progress'
                    defaultMessage='In Progress'
                  />
                )}
                {status === 'done' && (
                  <FormattedMessage
                    id='governance.task.done'
                    defaultMessage='Done'
                  />
                )}
              </h5>
              {statusTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClaim={status === 'open' ? handleClaimClick : undefined}
                  claiming={claiming === task.id}
                />
              ))}
            </div>
          ) : null;
        })}
      </section>

      {budgetItems.length > 0 && (
        <section className='governance-tab-kontribute__budget'>
          <h4 className='governance-tab-kontribute__section-heading'>
            <FormattedMessage
              id='governance.kontribute.budget'
              defaultMessage='Budget'
            />
          </h4>
          <table className='governance-budget-table'>
            <thead>
              <tr>
                <th>
                  <FormattedMessage
                    id='governance.budget.description'
                    defaultMessage='Description'
                  />
                </th>
                <th>
                  <FormattedMessage
                    id='governance.budget.estimate'
                    defaultMessage='Estimate'
                  />
                </th>
                <th>
                  <FormattedMessage
                    id='governance.budget.status'
                    defaultMessage='Status'
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {budgetItems.map((item) => (
                <BudgetItemRow key={item.id} item={item} />
              ))}
            </tbody>
            <tfoot>
              <tr className='governance-budget-table__total'>
                <td>
                  <FormattedMessage
                    id='governance.budget.total'
                    defaultMessage='Total'
                  />
                </td>
                <td>
                  {currency} {budgetTotal.toFixed(2)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </section>
      )}
    </div>
  );
};
