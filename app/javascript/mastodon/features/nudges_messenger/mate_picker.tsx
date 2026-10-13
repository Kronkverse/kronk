import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import {
  apiListNudgeMates,
  apiOpenMateConversation,
} from 'mastodon/api/nudges_conversations';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import type { ApiNudgeConversationJSON } from 'mastodon/api_types/nudges_conversations';
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
  // Nudges: picking a Mate opens the chat with them.
  onOpenConversation?: (conversation: ApiNudgeConversationJSON) => void;
  onClose: () => void;
  // Another korner borrowing the picker (Rose sends a rose from it): its own
  // title, its own thing to do with the Mate picked, and a word to show on
  // rows that are already done, which can then no longer be picked.
  title?: string;
  onPick?: (account: ApiAccountJSON) => Promise<void>;
  doneLabel?: (account: ApiAccountJSON) => string | null;
}

export const MatePicker: React.FC<MatePickerProps> = ({
  onOpenConversation,
  onClose,
  title,
  onPick,
  doneLabel,
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

  // What the server finds for the words typed. The list above is one page
  // of your Mates; anyone past it only turns up by asking.
  const [found, setFound] = useState<{
    query: string;
    list: ApiAccountJSON[];
  } | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q === '') {
      setFound(null);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      apiListNudgeMates(q)
        .then((list) => {
          if (!cancelled) setFound({ query: q, list });
          return undefined;
        })
        .catch(() => {
          // Keep what the loaded page matched.
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const filtered = useMemo(() => {
    if (!mates) return [];
    if (query.trim() === '') return mates;
    const q = query.trim().toLowerCase();
    // Straight away from the page in hand, then the server's fuller answer.
    const local = mates.filter(
      (a) =>
        (a.display_name || a.username).toLowerCase().includes(q) ||
        a.username.toLowerCase().includes(q),
    );
    if (found?.query !== query.trim()) return local;
    const seen = new Set(local.map((a) => a.id));
    return [...local, ...found.list.filter((a) => !seen.has(a.id))];
  }, [mates, query, found]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
    },
    [],
  );

  const handlePick = useCallback(
    (account: ApiAccountJSON) => {
      if (opening) return;
      setOpening(true);
      setError(null);
      void (async () => {
        try {
          if (onPick) {
            await onPick(account);
          } else {
            const conversation = await apiOpenMateConversation(account.id);
            onOpenConversation?.(conversation);
          }
        } catch {
          setError(intl.formatMessage(messages.error));
        } finally {
          setOpening(false);
        }
      })();
    },
    [intl, onOpenConversation, onPick, opening],
  );

  const heading = title ?? intl.formatMessage(messages.title);

  return (
    <div
      className='nudges-mate-picker'
      role='dialog'
      aria-modal
      aria-label={heading}
    >
      <button
        type='button'
        className='nudges-mate-picker__backdrop'
        aria-label={intl.formatMessage(messages.close)}
        onClick={onClose}
      />
      <div className='nudges-mate-picker__panel'>
        <header className='nudges-mate-picker__head'>
          <h2 className='nudges-mate-picker__title'>{heading}</h2>
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
              done={doneLabel?.(account) ?? null}
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
  done: string | null;
  onPick: (account: ApiAccountJSON) => void;
}

const MateRow: React.FC<MateRowProps> = ({
  account,
  disabled,
  done,
  onPick,
}) => {
  const handleClick = useCallback(() => {
    onPick(account);
  }, [account, onPick]);

  const shape = useMemo(() => createAccountFromServerJSON(account), [account]);

  return (
    <li className='nudges-mate-picker__row'>
      <button
        type='button'
        className='nudges-mate-picker__row-button'
        onClick={handleClick}
        disabled={disabled || done !== null}
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
        {done !== null && (
          <span className='nudges-mate-picker__row-done'>{done}</span>
        )}
      </button>
    </li>
  );
};
