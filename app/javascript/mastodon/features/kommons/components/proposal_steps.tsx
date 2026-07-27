import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import api from 'mastodon/api';

// The steps checklist — a proposal's `tasks` surfaced up front (per
// docs/spaces/kommons_proposal_page.md), with a progress bar and done-count.
// Ticking a step toggles it done <-> open via the shallow tasks update route.
// Read-only fallback: if the viewer can't update (403), the optimistic tick is
// rolled back and the row just reflects server state.

interface Task {
  id: string;
  title: string;
  status: string;
}

const messages = defineMessages({
  heading: { id: 'proposal.steps.heading', defaultMessage: 'Steps' },
  doing: { id: 'proposal.steps.in_progress', defaultMessage: 'In progress' },
  done: { id: 'proposal.steps.done', defaultMessage: 'Done' },
  todo: { id: 'proposal.steps.todo', defaultMessage: 'To do' },
});

export const ProposalSteps: React.FC<{ proposalId: string }> = ({
  proposalId,
}) => {
  const intl = useIntl();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    api()
      .get(`/api/v1/proposals/${proposalId}/tasks`)
      .then((res) => {
        if (active) {
          setTasks(res.data as Task[]);
          setLoaded(true);
        }
        return undefined;
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [proposalId]);

  const toggle = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const id = e.currentTarget.dataset.id;
      if (!id) return;
      const current = tasks.find((t) => t.id === id);
      if (!current) return;
      const next = current.status === 'done' ? 'open' : 'done';
      // Optimistic — roll back if the server rejects (e.g. not permitted).
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: next } : t)),
      );
      api()
        .patch(`/api/v1/tasks/${id}`, { task: { status: next } })
        .catch(() => {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === id ? { ...t, status: current.status } : t,
            ),
          );
        });
    },
    [tasks],
  );

  // Nothing to show until we know there are steps.
  if (!loaded || tasks.length === 0) return null;

  const done = tasks.filter((t) => t.status === 'done').length;
  const pct = Math.round((done / tasks.length) * 100);

  return (
    <section className='proposal-steps'>
      <h2 className='proposal-steps__heading'>
        {intl.formatMessage(messages.heading)}
        <span className='proposal-steps__count'>
          <FormattedMessage
            id='proposal.steps.count'
            defaultMessage='{done} of {total} done'
            values={{ done, total: tasks.length }}
          />
        </span>
      </h2>

      <div
        className='proposal-steps__progress'
        role='progressbar'
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ width: `${pct}%` }} />
      </div>

      <ul className='proposal-steps__list'>
        {tasks.map((task) => {
          const isDone = task.status === 'done';
          const tag = isDone
            ? messages.done
            : task.status === 'in_progress'
              ? messages.doing
              : messages.todo;
          return (
            <li
              key={task.id}
              className={`proposal-steps__step ${isDone ? 'is-done' : ''}`}
            >
              <button
                type='button'
                className='proposal-steps__toggle'
                data-id={task.id}
                onClick={toggle}
                aria-pressed={isDone}
              >
                <span className='proposal-steps__check' aria-hidden='true'>
                  {isDone ? '✓' : ''}
                </span>
                <span className='proposal-steps__text'>{task.title}</span>
                <span
                  className={`proposal-steps__tag proposal-steps__tag--${task.status}`}
                >
                  {intl.formatMessage(tag)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
