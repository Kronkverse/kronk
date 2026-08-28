import { useCallback, useMemo, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import classNames from 'classnames';

import { List as ImmutableList } from 'immutable';

import {
  changeComposeAudienceGrants,
  changeComposeAudienceExcludes,
} from 'mastodon/actions/compose';
import api from 'mastodon/api';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import { useAppSelector, useAppDispatch } from 'mastodon/store';

// The flyout panel for the reach dropdown's "@ People" row
// (docs/rebuild/per_post_audience.md). A slim account search; each result /
// current pick carries an In/Out toggle — In = let them see this even if your
// reach wouldn't (grant), Out = keep them from seeing it even though your reach
// would (exclude). Wired straight to the compose draft's audience_grants /
// audience_excludes. Only mounted on gated scopes (the adapter omits it for
// public), so it never offers to "restrict" a public post.

// Richer than AccountMultiSelect's AccountLite — we keep the avatar so a
// current pick renders even when it's not in the live search results.
interface PersonRef {
  id: string;
  acct: string;
  displayName: string;
  avatar: string;
}

type PersonState = 'none' | 'in' | 'out';

const DEBOUNCE_MS = 250;

const messages = defineMessages({
  search: {
    id: 'compose.audience.search',
    defaultMessage: 'Search people…',
  },
  letIn: { id: 'compose.audience.let_in', defaultMessage: 'Let in' },
  keepOut: { id: 'compose.audience.keep_out', defaultMessage: 'Keep out' },
  in: { id: 'compose.audience.in', defaultMessage: 'In' },
  out: { id: 'compose.audience.out', defaultMessage: 'Out' },
  empty: {
    id: 'compose.audience.empty',
    defaultMessage: 'Search to add or remove people.',
  },
});

const toRefs = (list: unknown): PersonRef[] =>
  ((list ?? ImmutableList()) as ImmutableList<PersonRef>).toArray();

const PersonRow: React.FC<{
  person: PersonRef;
  state: PersonState;
  onApply: (person: PersonRef, target: 'in' | 'out') => void;
}> = ({ person, state, onApply }) => {
  const intl = useIntl();
  const handleIn = useCallback(() => {
    onApply(person, 'in');
  }, [onApply, person]);
  const handleOut = useCallback(() => {
    onApply(person, 'out');
  }, [onApply, person]);

  return (
    <li className='audience-menu__row'>
      <img className='audience-menu__avatar' src={person.avatar} alt='' />
      <span className='audience-menu__name'>{person.displayName}</span>
      <span className='audience-menu__toggle'>
        <button
          type='button'
          className={classNames('audience-menu__toggle-btn', {
            'audience-menu__toggle-btn--in': state === 'in',
          })}
          title={intl.formatMessage(messages.letIn)}
          onClick={handleIn}
        >
          {intl.formatMessage(messages.in)}
        </button>
        <button
          type='button'
          className={classNames('audience-menu__toggle-btn', {
            'audience-menu__toggle-btn--out': state === 'out',
          })}
          title={intl.formatMessage(messages.keepOut)}
          onClick={handleOut}
        >
          {intl.formatMessage(messages.out)}
        </button>
      </span>
    </li>
  );
};

const fromApi = (account: ApiAccountJSON): PersonRef => ({
  id: account.id,
  acct: account.acct,
  displayName: account.display_name || account.username,
  avatar: account.avatar,
});

export const ComposeAudienceMenu: React.FC = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();

  const grants = useAppSelector((state) =>
    toRefs(state.compose.get('audience_grants')),
  );
  const excludes = useAppSelector((state) =>
    toRefs(state.compose.get('audience_excludes')),
  );

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PersonRef[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const searchIdRef = useRef(0);

  const stateOf = useCallback(
    (id: string): PersonState => {
      if (grants.some((p) => p.id === id)) return 'in';
      if (excludes.some((p) => p.id === id)) return 'out';
      return 'none';
    },
    [grants, excludes],
  );

  const apply = useCallback(
    (person: PersonRef, target: 'in' | 'out') => {
      const next = stateOf(person.id) === target ? 'none' : target;
      const nextGrants = grants.filter((p) => p.id !== person.id);
      const nextExcludes = excludes.filter((p) => p.id !== person.id);
      if (next === 'in') nextGrants.push(person);
      if (next === 'out') nextExcludes.push(person);
      dispatch(changeComposeAudienceGrants(nextGrants));
      dispatch(changeComposeAudienceExcludes(nextExcludes));
    },
    [stateOf, grants, excludes, dispatch],
  );

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setQuery(next);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const trimmed = next.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(() => {
      searchIdRef.current += 1;
      const mySearchId = searchIdRef.current;
      void api()
        .get<ApiAccountJSON[]>('/api/v1/accounts/search', {
          params: { q: trimmed, limit: 6, resolve: false },
        })
        .then((r) => {
          if (mySearchId === searchIdRef.current)
            setResults(r.data.map(fromApi));
          return undefined;
        })
        .catch(() => {
          if (mySearchId === searchIdRef.current) setResults([]);
        });
    }, DEBOUNCE_MS);
  }, []);

  // When searching, show matches; otherwise show the current picks so they can
  // be flipped or cleared. Dedupe by id (a pick may also match the query).
  const rows = useMemo<PersonRef[]>(() => {
    if (query.trim().length >= 2) return results;
    const seen = new Set<string>();
    return [...grants, ...excludes].filter((p) =>
      seen.has(p.id) ? false : (seen.add(p.id), true),
    );
  }, [query, results, grants, excludes]);

  return (
    <div className='audience-menu'>
      <input
        type='text'
        className='audience-menu__search'
        value={query}
        onChange={handleSearch}
        placeholder={intl.formatMessage(messages.search)}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
      />

      {rows.length === 0 ? (
        <p className='audience-menu__empty'>
          {intl.formatMessage(messages.empty)}
        </p>
      ) : (
        <ul className='audience-menu__list'>
          {rows.map((person) => (
            <PersonRow
              key={person.id}
              person={person}
              state={stateOf(person.id)}
              onApply={apply}
            />
          ))}
        </ul>
      )}
    </div>
  );
};
