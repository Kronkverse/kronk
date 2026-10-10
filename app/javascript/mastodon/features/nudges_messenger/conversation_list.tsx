import { useCallback, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link, useHistory, useLocation } from 'react-router-dom';

import NotificationsIcon from '@/material-icons/400-24px/notifications.svg?react';
import SearchIcon from '@/material-icons/400-24px/search.svg?react';
import type { ApiNudgeConversationJSON } from 'mastodon/api_types/nudges_conversations';
import { Icon } from 'mastodon/components/icon';

import { ConversationRow } from './conversation_row';
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
  requests: {
    id: 'nudges.requests',
    defaultMessage: 'Requests',
  },
  notifications: {
    id: 'nudges.face.notifications',
    defaultMessage: 'Notifications',
  },
});

// URL-driven picker: the Kronk menu's "New chat" action navigates to
// `/nudges/messages?compose=1`, we surface the mate picker and strip the flag
// on close. Keeps the sidebar chrome minimal (search input only) while
// leaving the compose affordance where every other create-action
// lives — the floating Kronk menu.
const COMPOSE_FLAG = 'compose';

interface ConversationListProps {
  conversations: ApiNudgeConversationJSON[];
  loading: boolean;
  activeId: string | null;
  unseenNotifications: number;
  onOpen: (id: string) => void;
  onNewConversation: (conversation: ApiNudgeConversationJSON) => void;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  loading,
  activeId,
  unseenNotifications,
  onOpen,
  onNewConversation,
  onAccept,
  onDecline,
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

  const requests = useMemo(
    () => conversations.filter((c) => c.request),
    [conversations],
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
      {/* The way back to the Notifications face. A swipe does the same on a
          phone; this is the control for everything without touch. */}
      <Link
        to='/nudges'
        className='nudges-sidebar__notifications'
        aria-label={intl.formatMessage(messages.notifications)}
        title={intl.formatMessage(messages.notifications)}
      >
        <Icon id='notifications' icon={NotificationsIcon} />
        {unseenNotifications > 0 && (
          <span className='nudges-sidebar__notifications-badge'>
            {unseenNotifications > 99 ? '99+' : unseenNotifications}
          </span>
        )}
      </Link>

      <div className='nudges-sidebar__search'>
        <SearchIcon
          className='nudges-sidebar__search-icon'
          aria-hidden='true'
        />
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

      {requests.length > 0 && (
        <>
          <p className='nudges-sidebar__section-heading'>
            {intl.formatMessage(messages.requests)}
          </p>
          <ul className='nudges-sidebar__list'>
            {requests.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                active={false}
                onOpen={onOpen}
                onAccept={onAccept}
                onDecline={onDecline}
              />
            ))}
          </ul>
        </>
      )}

      <ul className='nudges-sidebar__list'>
        {filtered
          .filter((conversation) => !conversation.request)
          .map((conversation) => (
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
