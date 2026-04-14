import { useCallback, useEffect, useState } from 'react';

import { FormattedMessage } from 'react-intl';

import api from 'mastodon/api';
import { me } from 'mastodon/initial_state';

import type { Task } from './tab_plan';

export const TabContribute: React.FC<{ proposalId: string }> = ({ proposalId }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api().get(`/api/v1/proposals/${proposalId}/tasks`);
        const allTasks = res.data as Task[];
        setTasks(allTasks.filter((t) => t.status === 'open'));
      } catch (err) {
        console.error('Failed to load tasks:', err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [proposalId]);

  const handleClaim = useCallback(
    async (taskId: string) => {
      if (!me) return;
      setClaiming(taskId);
      try {
        await api().patch(`/api/v1/tasks/${taskId}`, {
          task: { status: 'in_progress', assigned_to_account_id: me },
        });
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
      } catch (err) {
        console.error('Failed to claim task:', err);
      } finally {
        setClaiming(null);
      }
    },
    [],
  );

  const sorted = [...tasks].sort((a, b) =>
    (a.skill_tag ?? '').localeCompare(b.skill_tag ?? ''),
  );

  if (loading) {
    return (
      <div className='governance-tab-contribute__loading'>
        <FormattedMessage id='governance.loading' defaultMessage='Loading proposals…' />
      </div>
    );
  }

  return (
    <div className='governance-tab-contribute'>
      <h4 className='governance-tab-contribute__heading'>
        <FormattedMessage id='governance.contribute.heading' defaultMessage='How you can help' />
      </h4>

      {sorted.length === 0 ? (
        <p className='governance-tab-contribute__empty'>
          <FormattedMessage
            id='governance.contribute.empty'
            defaultMessage='All tasks are covered — check back soon'
          />
        </p>
      ) : (
        <div className='governance-tab-contribute__tasks'>
          {sorted.map((task) => (
            <div key={task.id} className='governance-contribute-task'>
              <div className='governance-contribute-task__info'>
                <span className='governance-contribute-task__title'>{task.title}</span>
                {task.skill_tag && (
                  <span className={`governance-skill-badge governance-skill-badge--${task.skill_tag}`}>
                    {task.skill_tag}
                  </span>
                )}
                {task.effort_estimate != null && (
                  <span className='governance-contribute-task__effort'>
                    <FormattedMessage
                      id='governance.task.effort'
                      defaultMessage='{hours}h'
                      values={{ hours: task.effort_estimate }}
                    />
                  </span>
                )}
                {task.description && (
                  <p className='governance-contribute-task__description'>{task.description}</p>
                )}
              </div>
              <button
                className='governance-contribute-task__claim-btn'
                onClick={() => void handleClaim(task.id)}
                disabled={claiming === task.id}
              >
                {claiming === task.id ? (
                  <FormattedMessage id='governance.task.claiming' defaultMessage='Claiming…' />
                ) : (
                  <FormattedMessage id='governance.task.claim' defaultMessage='Claim this task' />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
