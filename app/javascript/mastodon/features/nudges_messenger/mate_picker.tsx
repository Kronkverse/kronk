import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import {
  apiListNudgeMates,
  apiOpenMateConversation,
} from 'mastodon/api/nudges_conversations';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import { Avatar } from 'mastodon/components/avatar';
import { createAccountFromServerJSON } from 'mastodon/models/account';

const messages = defineMessages({
  title: { id: 'nudges.mate_picker.title', defaultMessage: 'New chat' },
  close: { id: 'nudges.mate_picker.close', defaultMessage: 'Close' },
  loading: { id: 'nudges.mate_picker.loading', defaultMessage: 'Loading…' },
  empty: {
    id: 'nudges.mate_picker.empty',
    defaultMessage: 'No Mates yet. Follow someone who follows you back.',
  },
  searchPlaceholder: {
    id: 'nudges.mate_picker.search_placeholder',
    defaultMessage: 'Search Mates',
  },
  noResults: {
    id: 'nudges.mate_picker.no_results',
    defaultMessage: 'No match',
  },
  error: {
    id: 'nudges.mate_picker.error',
    defaultMessage: 'Could not open the chat.',
  },
});

interface MatePickerProps {
  onOpenConversation: (conversationId: string) => void;
  onClose: () => void;
}

export const MatePicker: React.FC<MatePickerProps> = ({
  onOpenConversation,
  onClose,
}) => {
  const intl = useIntl();
  const [mates, setMates] = useState<ApiAccountJSON[] | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const list = await apiListNudgeMates();
        setMates(list);
      } catch {
        setMates([]);
        setError(intl.formatMessage(messages.error));
      }
    })();
  }, [intl]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    if (!mates) return [];
    if (query.trim() === '') return mates;
    const q = query.toLowerCase();
    return mates.filter(
      (a) =>
        (a.display_name || a.username).toLowerCase().includes(q) ||
        a.username.toLowerCase().includes(q),
    );
  }, [mates, query]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
    },
    [],
  );

  const handlePick = useCallback(
    (accountId: string) => {
      if (opening) return;
      setOpening(true);
      setError(null);
      void (async () => {
        try {
          const conversation = await apiOpenMateConversation(accountId);
          onOpenConversation(conversation.id);
        } catch {
          setError(intl.formatMessage(messages.error));
        } finally {
          setOpening(false);
        }
      })();
    },
    [intl, onOpenConversation, opening],
  );

  return (
    <div
      className='nudges-mate-picker'
      role='dialog'
      aria-modal
      aria-label={intl.formatMessage(messages.title)}
    >
      <button
        type='button'
        className='nudges-mate-picker__backdrop'
        aria-label={intl.formatMessage(messages.close)}
        onClick={onClose}
      />
      <div className='nudges-mate-picker__panel'>
        <header className='nudges-mate-picker__head'>
          <h2 className='nudges-mate-picker__title'>
            {intl.formatMessage(messages.title)}
          </h2>
          <button
            type='button'
            className='nudges-mate-picker__close'
            onClick={onClose}
            aria-label={intl.formatMessage(messages.close)}
          >
            <CloseIcon />
          </button>
        </header>

        <input
          ref={searchRef}
          type='search'
          className='nudges-mate-picker__search'
          placeholder={intl.formatMessage(messages.searchPlaceholder)}
          value={query}
          onChange={handleSearchChange}
        />

        {error && (
          <p className='nudges-mate-picker__status nudges-mate-picker__status--error'>
            {error}
          </p>
        )}

        {mates === null && !error && (
          <p className='nudges-mate-picker__status'>
            {intl.formatMessage(messages.loading)}
          </p>
        )}

        {mates !== null && mates.length === 0 && !error && (
          <p className='nudges-mate-picker__status'>
            {intl.formatMessage(messages.empty)}
          </p>
        )}

        {mates !== null && mates.length > 0 && filtered.length === 0 && (
          <p className='nudges-mate-picker__status'>
            {intl.formatMessage(messages.noResults)}
          </p>
        )}

        <ul className='nudges-mate-picker__list'>
          {filtered.map((account) => (
            <MateRow
              key={account.id}
              account={account}
              disabled={opening}
              onPick={handlePick}
            />
          ))}
        </ul>
      </div>
    </div>
  );
};

interface MateRowProps {
  account: ApiAccountJSON;
  disabled: boolean;
  onPick: (accountId: string) => void;
}

const MateRow: React.FC<MateRowProps> = ({ account, disabled, onPick }) => {
  const handleClick = useCallback(() => {
    onPick(account.id);
  }, [account.id, onPick]);

  const shape = useMemo(() => createAccountFromServerJSON(account), [account]);

  return (
    <li className='nudges-mate-picker__row'>
      <button
        type='button'
        className='nudges-mate-picker__row-button'
        onClick={handleClick}
        disabled={disabled}
      >
        <Avatar account={shape} size={36} />
        <span className='nudges-mate-picker__row-body'>
          <span className='nudges-mate-picker__row-name'>
            {account.display_name || account.username}
          </span>
          <span className='nudges-mate-picker__row-handle'>
            @{account.acct}
          </span>
        </span>
      </button>
    </li>
  );
};
