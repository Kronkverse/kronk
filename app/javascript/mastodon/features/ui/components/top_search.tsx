import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory, useLocation } from 'react-router-dom';

import SearchIcon from '@/material-icons/400-24px/search.svg?react';

// The search bar at the top right of a wide screen (Tal 2026-10-12, Kommons
// "Search option"). It is the way into the search page, not a second search:
// Enter goes to /hub/search with the words, and with the space you were in,
// so that space's results come first there. Phones keep Search in the Ж menu.

const HUB_ROUTE_RE = /^\/hub\/([a-z0-9-]+)/;

const messages = defineMessages({
  placeholder: { id: 'top_search.placeholder', defaultMessage: 'Search' },
});

// The space a page belongs to, for putting its results first. The search
// page itself, and anywhere outside a space, belongs to none.
export const spaceOf = (pathname: string): string | null => {
  const slug = HUB_ROUTE_RE.exec(pathname)?.[1];
  return slug && slug !== 'search' ? slug : null;
};

export const TopSearch: React.FC = () => {
  const intl = useIntl();
  const history = useHistory();
  const { pathname } = useLocation();
  const [query, setQuery] = useState('');

  const handleChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setQuery(e.currentTarget.value);
    },
    [],
  );

  const handleSubmit = useCallback<React.FormEventHandler<HTMLFormElement>>(
    (e) => {
      e.preventDefault();
      const words = query.trim();
      if (words === '') return;

      const params = new URLSearchParams({ q: words });
      const space = spaceOf(pathname);
      if (space) params.set('in', space);

      // A location object: this app's history.push loses a `?query` given
      // inside a string.
      history.push({
        pathname: '/hub/search',
        search: `?${params.toString()}`,
      });
      setQuery('');
    },
    [history, pathname, query],
  );

  // On the search page its own box is the one to type in.
  if (pathname === '/hub/search') return null;

  const label = intl.formatMessage(messages.placeholder);

  return (
    <form className='top-search' role='search' onSubmit={handleSubmit}>
      <SearchIcon className='top-search__icon' aria-hidden='true' />
      <input
        type='search'
        className='top-search__input'
        value={query}
        onChange={handleChange}
        placeholder={label}
        aria-label={label}
      />
    </form>
  );
};
