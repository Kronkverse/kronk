import { useCallback } from 'react';

import { FormattedMessage } from 'react-intl';

import type { Task } from './proposal_tabs/tab_kontribute';

interface Props {
  task: Task;
  onClaim?: (taskId: string) => void;
  claiming?: boolean;
}

export const TaskCard: React.FC<Props> = ({ task, onClaim, claiming }) => {
  const handleClaimClick = useCallback(() => {
    onClaim?.(task.id);
  }, [onClaim, task.id]);

  return (
    <div
      className={`governance-task-card governance-task-card--${task.status}`}
    >
      <div className='governance-task-card__header'>
        <span className='governance-task-card__title'>{task.title}</span>
        {task.skill_tag && (
          <span
            className={`governance-skill-badge governance-skill-badge--${task.skill_tag}`}
          >
            {task.skill_tag}
          </span>
        )}
        {task.effort_estimate != null && (
          <span className='governance-task-card__effort'>
            {task.effort_estimate}h
          </span>
        )}
      </div>

      {task.description && (
        <p className='governance-task-card__description'>{task.description}</p>
      )}

      {task.assigned_to_account && (
        <div className='governance-task-card__assignee'>
          <img
            src={task.assigned_to_account.avatar}
            alt={
              task.assigned_to_account.display_name ||
              task.assigned_to_account.username
            }
            className='governance-task-card__assignee-avatar'
          />
          <span>
            {task.assigned_to_account.display_name ||
              task.assigned_to_account.username}
          </span>
        </div>
      )}

      {onClaim && (
        <button
          className='governance-task-card__claim-btn'
          onClick={handleClaimClick}
          disabled={claiming}
        >
          {claiming ? (
            <FormattedMessage
              id='governance.task.claiming'
              defaultMessage='Claiming…'
            />
          ) : (
            <FormattedMessage
              id='governance.task.claim'
              defaultMessage='Claim this task'
            />
          )}
        </button>
      )}
    </div>
  );
};
