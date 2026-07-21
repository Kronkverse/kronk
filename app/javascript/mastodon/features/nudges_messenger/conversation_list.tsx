import { useCallback, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import SearchIcon from '@/material-icons/400-24px/search.svg?react';
import type { ApiNudgeConversationJSON } from 'mastodon/api_types/nudges_conversations';

import { ConversationRow } from './conversation_row';

const messages = defineMessages({
  searchPlaceholder: {
    id: 'nudges.search_placeholder',
    defaultMessage: 'Search chats',
  },
  loading: { id: 'nudges.loading', defaultMessage: 'Loading…' },
  empty: {
    id: 'nudges.empty_conversations',
    defaultMessage: 'No conversations yet',
  },
  noResults: {
    id: 'nudges.no_search_results',
    defaultMessage: 'No match',
  },
});

interface ConversationListProps {
  conversations: ApiNudgeConversationJSON[];
  loading: boolean;
  activeId: string | null;
  onOpen: (id: string) => void;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  loading,
  activeId,
  onOpen,
}) => {
  const intl = useIntl();
  const [query, setQuery] = useState('');

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
    },
    [],
  );

  const filtered = useMemo(() => {
    if (query.trim() === '') return conversations;
    const q = query.toLowerCase();
    return conversations.filter((c) => {
      const name =
        c.other_account?.display_name ?? c.other_account?.username ?? '';
      return name.toLowerCase().includes(q);
    });
  }, [conversations, query]);

  return (
    <div className='nudges-sidebar'>
      <div className='nudges-sidebar__search'>
        <SearchIcon className='nudges-sidebar__search-icon' />
        <input
          type='search'
          className='nudges-sidebar__search-input'
          placeholder={intl.formatMessage(messages.searchPlaceholder)}
          value={query}
          onChange={handleSearchChange}
        />
      </div>

      {loading && (
        <p className='nudges-sidebar__status'>
          {intl.formatMessage(messages.loading)}
        </p>
      )}

      {!loading && filtered.length === 0 && (
        <p className='nudges-sidebar__status'>
          {intl.formatMessage(query ? messages.noResults : messages.empty)}
        </p>
      )}

      <ul className='nudges-sidebar__list'>
        {filtered.map((conversation) => (
          <ConversationRow
            key={conversation.id}
            conversation={conversation}
            active={conversation.id === activeId}
            onOpen={onOpen}
          />
        ))}
      </ul>
    </div>
  );
};
