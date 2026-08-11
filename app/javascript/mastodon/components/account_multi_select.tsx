import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import api from 'mastodon/api';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import { Avatar } from 'mastodon/components/avatar';
import { Icon } from 'mastodon/components/icon';

// AccountMultiSelect — a reusable inline "pick some people" control: a
// debounced search against /api/v1/accounts/search, selected accounts shown
// as removable chips. Controlled by a list of lightweight account refs so the
// caller only ever holds what it needs (id + display bits). Extracted from the
// Moments tag-people search so composers share one account picker.

export interface AccountLite {
  id: string;
  acct: string;
  displayName: string;
}

const messages = defineMessages({
  placeholder: {
    id: 'account_multi_select.placeholder',
    defaultMessage: 'Search for a person…',
  },
  remove: {
    id: 'account_multi_select.remove',
    defaultMessage: 'Remove {name}',
  },
  noMatches: {
    id: 'account_multi_select.no_matches',
    defaultMessage: 'No matches.',
  },
});

const DEBOUNCE_MS = 250;

interface Props {
  value: AccountLite[];
  onChange: (next: AccountLite[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

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
      className='account-multi-select__suggestion'
      onClick={handleClick}
    >
      <Avatar account={account as never} size={24} />
      <span className='account-multi-select__suggestion-name'>
        {account.display_name || account.username}
      </span>
      <span className='account-multi-select__suggestion-acct'>
        @{account.acct}
      </span>
    </button>
  );
});
SuggestionRow.displayName = 'SuggestionRow';

const PickedChip = memo<{
  account: AccountLite;
  removeLabel: string;
  onRemove: (id: string) => void;
}>(({ account, removeLabel, onRemove }) => {
  const handleRemove = useCallback(() => {
    onRemove(account.id);
  }, [onRemove, account.id]);
  return (
    <li className='account-multi-select__chip'>
      <span className='account-multi-select__chip-name'>@{account.acct}</span>
      <button
        type='button'
        className='account-multi-select__chip-remove'
        onClick={handleRemove}
        aria-label={removeLabel}
      >
        <Icon id='close' icon={CloseIcon} />
      </button>
    </li>
  );
});
PickedChip.displayName = 'PickedChip';

export const AccountMultiSelect: React.FC<Props> = ({
  value,
  onChange,
  disabled = false,
  placeholder,
}) => {
  const intl = useIntl();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<ApiAccountJSON[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guard against a stale response overwriting a newer one.
  const searchIdRef = useRef(0);

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setQuery(next);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      const trimmed = next.trim();
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

  const handleSelectAccount = useCallback(
    (account: ApiAccountJSON) => {
      if (!value.some((a) => a.id === account.id)) {
        onChange([
          ...value,
          {
            id: account.id,
            acct: account.acct,
            displayName: account.display_name || account.username,
          },
        ]);
      }
      setQuery('');
      setSuggestions([]);
    },
    [value, onChange],
  );

  const handleRemove = useCallback(
    (id: string) => {
      onChange(value.filter((a) => a.id !== id));
    },
    [value, onChange],
  );

  return (
    <div className='account-multi-select'>
      <input
        type='text'
        className='account-multi-select__search'
        value={query}
        onChange={handleQueryChange}
        placeholder={placeholder ?? intl.formatMessage(messages.placeholder)}
        disabled={disabled}
      />

      {query.trim().length >= 2 && (
        <ul className='account-multi-select__suggestions'>
          {suggestions.map((account) => (
            <li key={account.id}>
              <SuggestionRow account={account} onSelect={handleSelectAccount} />
            </li>
          ))}
          {!searching && suggestions.length === 0 && (
            <li className='account-multi-select__no-matches'>
              {intl.formatMessage(messages.noMatches)}
            </li>
          )}
        </ul>
      )}

      {value.length > 0 && (
        <ul className='account-multi-select__chips'>
          {value.map((account) => (
            <PickedChip
              key={account.id}
              account={account}
              removeLabel={intl.formatMessage(messages.remove, {
                name: `@${account.acct}`,
              })}
              onRemove={handleRemove}
            />
          ))}
        </ul>
      )}
    </div>
  );
};
