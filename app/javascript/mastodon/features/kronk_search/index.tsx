// Kronk Search — universal search surface.
//
// Route: /hub/search
// Uses the /api/v2/search endpoint (Kronk::Search adapter when
// SEARCH_BACKEND=meilisearch, upstream SearchService otherwise —
// response shape is identical).
//
// Ships:
//   - Search input (submits on Enter or the search button)
//   - Contextual scope chip inferred from the previous route
//     via useSearchScope (spec §"UX")
//   - Recent-searches (localStorage, client-only — spec §"Query logging")
//   - Result groups by object type with counts
//
// Deferred to a follow-up PR:
//   - Advanced filter panel (date range, author, kategory, korner, visibility)
//   - Per-type "See all" endpoints
//   - Kronk-type surfaces (events, proposals, booth sets, listings, groups)
//     once PR 3's endpoint is extended

import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import SearchIcon from '@/material-icons/400-24px/search.svg?react';
import type { ApiSearchResults } from 'mastodon/api/kronk_search';
import { apiKronkSearch } from 'mastodon/api/kronk_search';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';

import { RecentList } from './components/recent_list';
import { ResultGroups } from './components/result_groups';
import { ScopeChip } from './components/scope_chip';
import { useRecentSearches } from './hooks/useRecentSearches';
import { useSearchScope } from './hooks/useSearchScope';
import type { SearchScope } from './hooks/useSearchScope';

const messages = defineMessages({
  title: { id: 'kronk_search.title', defaultMessage: 'Search' },
  placeholder: {
    id: 'kronk_search.placeholder',
    defaultMessage: 'Find people, posts, kategories\u2026',
  },
  submit: { id: 'kronk_search.submit', defaultMessage: 'Search' },
  loading: { id: 'kronk_search.loading', defaultMessage: 'Searching\u2026' },
  error: {
    id: 'kronk_search.error',
    defaultMessage: 'Search failed. Try again in a moment.',
  },
});

const universalScope = (): SearchScope => ({ kind: 'universal' });

const KronkSearch: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const inferredScope = useSearchScope();
  const { recent, record, forget, clear } = useRecentSearches();

  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SearchScope>(inferredScope);
  const [results, setResults] = useState<ApiSearchResults | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Reset scope to inferred on route change; the user can still widen.
  useEffect(() => {
    setScope(inferredScope);
  }, [inferredScope]);

  const runSearch = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) {
        setResults(null);
        setStatus('idle');
        return;
      }
      setStatus('loading');
      apiKronkSearch({ q: trimmed })
        .then((res) => {
          setResults(res);
          setStatus('idle');
          record(trimmed);
        })
        .catch(() => {
          setStatus('error');
        });
    },
    [record],
  );

  const handleInputChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setQuery(e.target.value);
  }, []);

  const handleSubmit = useCallback<React.FormEventHandler<HTMLFormElement>>(
    (e) => {
      e.preventDefault();
      runSearch(query);
    },
    [query, runSearch],
  );

  const handlePickRecent = useCallback(
    (q: string) => {
      setQuery(q);
      runSearch(q);
    },
    [runSearch],
  );

  const handleWidenScope = useCallback(() => {
    setScope(universalScope());
  }, []);

  const title = intl.formatMessage(messages.title);

  return (
    <Column bindToDocument={!multiColumn} label={title}>
      <ColumnHeader icon='search' title={title} multiColumn={multiColumn} />

      <div className='kronk-search'>
        <form className='kronk-search__form' onSubmit={handleSubmit}>
          <label className='kronk-search__input-wrap'>
            <SearchIcon
              className='kronk-search__input-icon'
              aria-hidden='true'
            />
            <input
              ref={inputRef}
              type='search'
              className='kronk-search__input'
              value={query}
              onChange={handleInputChange}
              placeholder={intl.formatMessage(messages.placeholder)}
            />
          </label>
          <button type='submit' className='kronk-search__submit'>
            {intl.formatMessage(messages.submit)}
          </button>
        </form>

        <ScopeChip scope={scope} onWiden={handleWidenScope} />

        {status === 'loading' && (
          <p className='kronk-search__loading'>
            {intl.formatMessage(messages.loading)}
          </p>
        )}

        {status === 'error' && (
          <p className='kronk-search__error'>
            {intl.formatMessage(messages.error)}
          </p>
        )}

        {status !== 'error' && results && <ResultGroups results={results} />}

        {status === 'idle' && !results && (
          <RecentList
            queries={recent}
            onPick={handlePickRecent}
            onForget={forget}
            onClear={clear}
          />
        )}
      </div>

      <Helmet>
        <title>{title}</title>
      </Helmet>
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export
export default KronkSearch;
export { KronkSearch };
