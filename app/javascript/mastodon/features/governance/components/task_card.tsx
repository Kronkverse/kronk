import type { Task } from './proposal_tabs/tab_plan';

export const TaskCard: React.FC<{ task: Task }> = ({ task }) => (
  <div className={`governance-task-card governance-task-card--${task.status}`}>
    <div className='governance-task-card__header'>
      <span className='governance-task-card__title'>{task.title}</span>
      {task.skill_tag && (
        <span className={`governance-skill-badge governance-skill-badge--${task.skill_tag}`}>
          {task.skill_tag}
        </span>
      )}
      {task.effort_estimate != null && (
        <span className='governance-task-card__effort'>{task.effort_estimate}h</span>
      )}
    </div>

    {task.description && (
      <p className='governance-task-card__description'>{task.description}</p>
    )}

    {task.assigned_to_account && (
      <div className='governance-task-card__assignee'>
        <img
          src={task.assigned_to_account.avatar}
          alt={task.assigned_to_account.display_name || task.assigned_to_account.username}
          className='governance-task-card__assignee-avatar'
        />
        <span>{task.assigned_to_account.display_name || task.assigned_to_account.username}</span>
      </div>
    )}
  </div>
);
