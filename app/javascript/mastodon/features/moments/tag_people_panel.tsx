import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import api from 'mastodon/api';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import { Avatar } from 'mastodon/components/avatar';
import { Icon } from 'mastodon/components/icon';

// Moments — inline tag-people panel. Lets the composer collect a list
// of accounts to tag on the active photo item before it's uploaded.
// Unlike the Statuses `TagPeopleModal`, this one is stateless: the
// composer owns the picked list per-item, and posts the tags after
// the media upload (once we have a media_attachment id) as part of
// submit. No pending_media_tags global store here.
//
// UI is a floating card, positioned inside the composer hero by its
// parent. Search debounces at 250ms against /api/v1/accounts/search.

export interface TaggedAccountLite {
  accountId: string;
  acct: string;
  displayName: string;
}

const messages = defineMessages({
  title: {
    id: 'moments.tag_people.title',
    defaultMessage: 'Tag people',
  },
  placeholder: {
    id: 'moments.tag_people.placeholder',
    defaultMessage: 'Search for a person…',
  },
  done: {
    id: 'moments.tag_people.done',
    defaultMessage: 'Done',
  },
  remove: {
    id: 'moments.tag_people.remove',
    defaultMessage: 'Remove',
  },
  empty: {
    id: 'moments.tag_people.empty',
    defaultMessage: 'No one tagged yet.',
  },
  noMatches: {
    id: 'moments.tag_people.no_matches',
    defaultMessage: 'No matches.',
  },
});

const DEBOUNCE_MS = 250;

interface Props {
  initial: TaggedAccountLite[];
  onSave: (tags: TaggedAccountLite[]) => void;
  onClose: () => void;
}

// Suggestion row extracted so its click handler can `useCallback`
// without an inline arrow in JSX (react/jsx-no-bind).
const SuggestionRow = memo<{
  account: ApiAccountJSON;
  onSelect: (account: ApiAccountJSON) => void;
}>(({ account, onSelect }) => {
  const handleClick = useCallback(() => {
    onSelect(account);
  }, [account, onSelect]);
  return (
    <button
      type='button'
      className='moments-tag-panel__suggestion'
      onClick={handleClick}
    >
      <Avatar account={account as never} size={24} />
      <span className='moments-tag-panel__suggestion-name'>
        {account.display_name || account.username}
      </span>
      <span className='moments-tag-panel__suggestion-acct'>
        @{account.acct}
      </span>
    </button>
  );
});
SuggestionRow.displayName = 'SuggestionRow';

// Chip for a picked account, with its own remove handler bound to the id.
const PickedChip = memo<{
  tag: TaggedAccountLite;
  removeLabel: string;
  onRemove: (accountId: string) => void;
}>(({ tag, removeLabel, onRemove }) => {
  const handleRemove = useCallback(() => {
    onRemove(tag.accountId);
  }, [onRemove, tag.accountId]);
  return (
    <li className='moments-tag-panel__chip'>
      <span className='moments-tag-panel__chip-name'>@{tag.acct}</span>
      <button
        type='button'
        className='moments-tag-panel__chip-remove'
        onClick={handleRemove}
        aria-label={removeLabel}
      >
        <Icon id='close' icon={CloseIcon} />
      </button>
    </li>
  );
});
PickedChip.displayName = 'PickedChip';

export const MomentsTagPeoplePanel: React.FC<Props> = ({
  initial,
  onSave,
  onClose,
}) => {
  const intl = useIntl();
  const [tags, setTags] = useState<TaggedAccountLite[]>(initial);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<ApiAccountJSON[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Guard against a stale response overwriting a newer one — same
  // pattern as PlaceControl's searchIdRef.
  const searchIdRef = useRef(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      const trimmed = value.trim();
      if (trimmed.length < 2) {
        setSuggestions([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      searchTimer.current = setTimeout(() => {
        searchIdRef.current += 1;
        const mySearchId = searchIdRef.current;
        void api()
          .get<ApiAccountJSON[]>('/api/v1/accounts/search', {
            params: { q: trimmed, limit: 5, resolve: false },
          })
          .then((r) => {
            if (mySearchId !== searchIdRef.current) return;
            setSuggestions(r.data);
            setSearching(false);
          })
          .catch(() => {
            if (mySearchId !== searchIdRef.current) return;
            setSuggestions([]);
            setSearching(false);
          });
      }, DEBOUNCE_MS);
    },
    [],
  );

  const handleSelectAccount = useCallback((account: ApiAccountJSON) => {
    setTags((prev) => {
      if (prev.find((t) => t.accountId === account.id)) return prev;
      return [
        ...prev,
        {
          accountId: account.id,
          acct: account.acct,
          displayName: account.display_name || account.username,
        },
      ];
    });
    setQuery('');
    setSuggestions([]);
    inputRef.current?.focus();
  }, []);

  const handleRemoveTag = useCallback((accountId: string) => {
    setTags((prev) => prev.filter((t) => t.accountId !== accountId));
  }, []);

  const handleDone = useCallback(() => {
    onSave(tags);
    onClose();
  }, [tags, onSave, onClose]);

  return (
    <div
      className='moments-tag-panel'
      role='dialog'
      aria-label={intl.formatMessage(messages.title)}
    >
      <div className='moments-tag-panel__header'>
        <h3 className='moments-tag-panel__title'>
          {intl.formatMessage(messages.title)}
        </h3>
        <button
          type='button'
          className='moments-tag-panel__close'
          onClick={onClose}
          aria-label={intl.formatMessage(messages.done)}
        >
          <Icon id='close' icon={CloseIcon} />
        </button>
      </div>

      <input
        ref={inputRef}
        type='text'
        className='moments-tag-panel__search'
        value={query}
        onChange={handleQueryChange}
        placeholder={intl.formatMessage(messages.placeholder)}
      />

      {query.trim().length >= 2 && (
        <ul className='moments-tag-panel__suggestions'>
          {suggestions.map((account) => (
            <li key={account.id}>
              <SuggestionRow account={account} onSelect={handleSelectAccount} />
            </li>
          ))}
          {!searching && suggestions.length === 0 && (
            <li className='moments-tag-panel__empty'>
              {intl.formatMessage(messages.noMatches)}
            </li>
          )}
        </ul>
      )}

      {tags.length > 0 ? (
        <ul className='moments-tag-panel__chips'>
          {tags.map((tag) => (
            <PickedChip
              key={tag.accountId}
              tag={tag}
              removeLabel={intl.formatMessage(messages.remove)}
              onRemove={handleRemoveTag}
            />
          ))}
        </ul>
      ) : (
        query.trim().length < 2 && (
          <p className='moments-tag-panel__empty'>
            {intl.formatMessage(messages.empty)}
          </p>
        )
      )}

      <div className='moments-tag-panel__footer'>
        <button
          type='button'
          className='button moments-tag-panel__done'
          onClick={handleDone}
        >
          {intl.formatMessage(messages.done)}
        </button>
      </div>
    </div>
  );
};
