import { useCallback, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory, useLocation } from 'react-router-dom';

import type { ApiNudgeConversationJSON } from 'mastodon/api_types/nudges_conversations';

import { ConversationRow } from './conversation_row';
import { KronkNudgerRow } from './kronk_nudger_row';
import { KRONK_CONVERSATION_ID } from './kronk_system';
import { MatePicker } from './mate_picker';

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

// URL-driven picker: the Kronk menu's "New chat" action navigates to
// `/nudges?compose=1`, we surface the mate picker and strip the flag
// on close. Keeps the sidebar chrome minimal (search input only) while
// leaving the compose affordance where every other create-action
// lives — the floating Kronk menu.
const COMPOSE_FLAG = 'compose';

interface ConversationListProps {
  conversations: ApiNudgeConversationJSON[];
  loading: boolean;
  activeId: string | null;
  onOpen: (id: string) => void;
  onNewConversation: (conversation: ApiNudgeConversationJSON) => void;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  loading,
  activeId,
  onOpen,
  onNewConversation,
}) => {
  const intl = useIntl();
  const history = useHistory();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const picking = useMemo(
    () => new URLSearchParams(location.search).get(COMPOSE_FLAG) === '1',
    [location.search],
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
    },
    [],
  );

  const handleClosePicker = useCallback(() => {
    const params = new URLSearchParams(location.search);
    params.delete(COMPOSE_FLAG);
    const suffix = params.toString();
    history.replace(
      `${location.pathname}${suffix ? `?${suffix}` : ''}${location.hash}`,
    );
  }, [history, location.pathname, location.search, location.hash]);

  const handlePickerOpen = useCallback(
    (conversation: ApiNudgeConversationJSON) => {
      handleClosePicker();
      onNewConversation(conversation);
      onOpen(conversation.id);
    },
    [handleClosePicker, onNewConversation, onOpen],
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
        {query.trim() === '' && (
          <KronkNudgerRow
            active={activeId === KRONK_CONVERSATION_ID}
            onOpen={onOpen}
          />
        )}
        {filtered.map((conversation) => (
          <ConversationRow
            key={conversation.id}
            conversation={conversation}
            active={conversation.id === activeId}
            onOpen={onOpen}
          />
        ))}
      </ul>

      {picking && (
        <MatePicker
          onOpenConversation={handlePickerOpen}
          onClose={handleClosePicker}
        />
      )}
    </div>
  );
};
