import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import api from 'mastodon/api';
import { me } from 'mastodon/initial_state';

import type { BoothArtistAccount } from '../types';

// Who made a set with you. The uploader is the artist, always (Tal
// 2026-10-12, Kommons proposal "Artists Grouping"), so there is no artist
// name to type any more. This adds the others: a Kronk account, tagged and
// shown as unverified until that person confirms it, or a plain name for
// someone who is not on Kronk.

export interface CreditDraft {
  account: BoothArtistAccount | null;
  name: string | null;
}

export const creditsPayload = (credits: CreditDraft[]) =>
  credits.map((credit) =>
    credit.account ? { account_id: credit.account.id } : { name: credit.name },
  );

const MAX = 10;

const messages = defineMessages({
  label: { id: 'booth.credits.label', defaultMessage: 'Made with' },
  hint: {
    id: 'booth.credits.hint',
    defaultMessage:
      'You are the artist. Add anyone who made this with you: tag them if they are on Kronk, or type their name if they are not.',
  },
  placeholder: {
    id: 'booth.credits.placeholder',
    defaultMessage: 'Search Kronk, or type a name',
  },
  addName: {
    id: 'booth.credits.add_name',
    defaultMessage: 'Add “{name}” as a name (not on Kronk)',
  },
  remove: { id: 'booth.credits.remove', defaultMessage: 'Remove {name}' },
});

const labelOf = (credit: CreditDraft) =>
  credit.account ? `@${credit.account.username}` : (credit.name ?? '');

interface Props {
  value: CreditDraft[];
  onChange: (next: CreditDraft[]) => void;
  disabled?: boolean;
}

export const CreditsField: React.FC<Props> = ({
  value,
  onChange,
  disabled,
}) => {
  const intl = useIntl();
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<BoothArtistAccount[]>([]);

  const term = query.trim();

  useEffect(() => {
    if (term.length < 2) {
      setFound([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      api()
        .get<BoothArtistAccount[]>('/api/v1/accounts/search', {
          params: { q: term, limit: 5, resolve: false },
        })
        .then((res) => {
          if (!cancelled) setFound(res.data);
          return undefined;
        })
        .catch(() => {
          if (!cancelled) setFound([]);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  const handleQuery = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  }, []);

  const add = useCallback(
    (credit: CreditDraft) => {
      if (value.length >= MAX) return;
      onChange([...value, credit]);
      setQuery('');
      setFound([]);
    },
    [onChange, value],
  );

  const handlePickAccount = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const account = found.find((a) => a.id === e.currentTarget.value);
      if (account) add({ account, name: null });
    },
    [add, found],
  );

  const handleAddName = useCallback(() => {
    if (term) add({ account: null, name: term.slice(0, 100) });
  }, [add, term]);

  // Enter in this box adds the typed name; it must not submit the form.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      handleAddName();
    },
    [handleAddName],
  );

  const handleRemove = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const index = Number(e.currentTarget.value);
      onChange(value.filter((_, i) => i !== index));
    },
    [onChange, value],
  );

  const taken = new Set(value.map((c) => c.account?.id));
  const suggestions = found.filter((a) => a.id !== me && !taken.has(a.id));
  const full = value.length >= MAX;

  return (
    <div className='booth-upload-form__field booth-credits'>
      <span>{intl.formatMessage(messages.label)}</span>
      <p className='booth-credits__hint'>{intl.formatMessage(messages.hint)}</p>

      {value.length > 0 && (
        <ul className='booth-credits__list'>
          {value.map((credit, index) => (
            <li key={labelOf(credit)} className='booth-credits__chip'>
              {credit.account && (
                <img src={credit.account.avatar} alt='' aria-hidden='true' />
              )}
              <span>{labelOf(credit)}</span>
              <button
                type='button'
                value={index}
                onClick={handleRemove}
                disabled={disabled}
                aria-label={intl.formatMessage(messages.remove, {
                  name: labelOf(credit),
                })}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {!full && (
        <input
          type='text'
          value={query}
          onChange={handleQuery}
          onKeyDown={handleKeyDown}
          placeholder={intl.formatMessage(messages.placeholder)}
          maxLength={100}
          disabled={disabled}
        />
      )}

      {!full && term.length >= 2 && (
        <ul className='booth-credits__found'>
          {suggestions.map((account) => (
            <li key={account.id}>
              <button
                type='button'
                value={account.id}
                onClick={handlePickAccount}
              >
                <img src={account.avatar} alt='' aria-hidden='true' />
                <span>{account.display_name || account.username}</span>
                <span className='booth-credits__handle'>
                  @{account.username}
                </span>
              </button>
            </li>
          ))}
          <li>
            <button type='button' onClick={handleAddName}>
              {intl.formatMessage(messages.addName, { name: term })}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
};
