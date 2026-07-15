import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

const messages = defineMessages({
  heading: {
    id: 'kronk_search.recent.heading',
    defaultMessage: 'Recent searches',
  },
  clear: {
    id: 'kronk_search.recent.clear',
    defaultMessage: 'Clear all',
  },
  forgetLabel: {
    id: 'kronk_search.recent.forget',
    defaultMessage: 'Forget \u201c{query}\u201d',
  },
});

interface Props {
  queries: string[];
  onPick: (query: string) => void;
  onForget: (query: string) => void;
  onClear: () => void;
}

export const RecentList: React.FC<Props> = ({ queries, onPick, onForget, onClear }) => {
  const intl = useIntl();

  const handlePick = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
    (e) => {
      const q = e.currentTarget.dataset.query;
      if (q) onPick(q);
    },
    [onPick],
  );

  const handleForget = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
    (e) => {
      e.stopPropagation();
      const q = e.currentTarget.dataset.query;
      if (q) onForget(q);
    },
    [onForget],
  );

  if (queries.length === 0) return null;

  return (
    <div className='kronk-search__recent'>
      <div className='kronk-search__recent-header'>
        <h3>{intl.formatMessage(messages.heading)}</h3>
        <button type='button' className='kronk-search__recent-clear' onClick={onClear}>
          {intl.formatMessage(messages.clear)}
        </button>
      </div>
      <ul className='kronk-search__recent-list'>
        {queries.map((q) => (
          <li key={q}>
            <button
              type='button'
              className='kronk-search__recent-item'
              data-query={q}
              onClick={handlePick}
            >
              {q}
            </button>
            <button
              type='button'
              className='kronk-search__recent-forget'
              data-query={q}
              onClick={handleForget}
              aria-label={intl.formatMessage(messages.forgetLabel, { query: q })}
              title={intl.formatMessage(messages.forgetLabel, { query: q })}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
