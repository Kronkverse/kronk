import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { importFetchedAccounts } from 'mastodon/actions/importer';
import {
  apiGetKommunityEveryone,
  apiGetKommunityMates,
} from 'mastodon/api/kommunity';
import { Account } from 'mastodon/components/account';
import { EmptyState } from 'mastodon/components/empty_state';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LoadingState } from 'mastodon/components/loading_state';
import { useAppDispatch } from 'mastodon/store';

// Kommunity Everyone, the middle view (Tal's Kommons proposal "Landing
// Page", #117483791865274639: "a full list of 'Visible' Users (if they
// choose to be visible)"). The whole directory, alphabetical, one shared
// `<Account>` row each — the same row the Mates tab uses, so a tap opens
// the profile and the row carries its own Mate button.
//
// Who is on it is decided by the server (Api::V1::Kommunity::
// EveryoneController): findable by everyone, or by Orbit when you are in
// it. Someone who chose nobody is never here, Mates included. Unlike
// Discover, visible Mates are listed: this is a directory.
//
// The search field filters by name or handle on the server, debounced.
// Paging is offset-based (an alphabetical list has no id cursor), with
// "Load more" at the foot like the Mates tab. Vertical scroll only.

const PAGE_SIZE = 40;
const SEARCH_DEBOUNCE_MS = 300;

const messages = defineMessages({
  search: {
    id: 'kommunity.everyone.search',
    defaultMessage: 'Search by name or handle',
  },
  empty: {
    id: 'kommunity.everyone.empty',
    defaultMessage: 'No one to show yet.',
  },
  emptyBody: {
    id: 'kommunity.everyone.empty_body',
    defaultMessage:
      'People appear here when they choose to be visible to you in their privacy settings.',
  },
  noMatch: {
    id: 'kommunity.everyone.no_match',
    defaultMessage: 'No one matches “{query}”.',
  },
  error: {
    id: 'kommunity.everyone.error',
    defaultMessage: 'Could not load the list.',
  },
  loadMore: {
    id: 'kommunity.everyone.load_more',
    defaultMessage: 'Load more',
  },
  matesSearch: {
    id: 'kommunity.mates.search',
    defaultMessage: 'Search your Mates',
  },
  matesEmpty: {
    id: 'kommunity.mates.empty',
    defaultMessage: 'No Mates yet.',
  },
  matesEmptyBody: {
    id: 'kommunity.mates.empty_body',
    defaultMessage:
      'Turn to Discover or Everyone to find people, and send a Mate request from their card.',
  },
});

type Fetcher = typeof apiGetKommunityEveryone;

interface ListText {
  search: string;
  empty: string;
  emptyBody: string;
}

// One list, two sources: Everyone (the directory, A to Z) and Mates (the
// landing view: your Mates, most recent poster first; Kommons "Kommunity
// Page", #117596933443323274). Same row, search and paging.
const KommunityPeopleList: React.FC<{ fetch: Fetcher; text: ListText }> = ({
  fetch,
  text,
}) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  // Every fetch stamps the run it belongs to; a result from an older run
  // (the query changed while it was in flight) is dropped.
  const runId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(input.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [input]);

  useEffect(() => {
    runId.current += 1;
    const run = runId.current;
    setLoading(true);
    setError(false);

    fetch(query, 0, PAGE_SIZE)
      .then(({ accounts, nextOffset: next }) => {
        if (runId.current !== run) return;
        dispatch(importFetchedAccounts(accounts));
        setAccountIds(accounts.map((account) => account.id));
        setNextOffset(next);
      })
      .catch(() => {
        if (runId.current === run) setError(true);
      })
      .finally(() => {
        if (runId.current === run) setLoading(false);
      });
  }, [query, dispatch, fetch]);

  const handleLoadMore = useCallback(() => {
    if (nextOffset === null || loadingMore) return;
    const run = runId.current;
    setLoadingMore(true);

    fetch(query, nextOffset, PAGE_SIZE)
      .then(({ accounts, nextOffset: next }) => {
        if (runId.current !== run) return;
        dispatch(importFetchedAccounts(accounts));
        // Drop ids already held: the list can shift under an offset if
        // someone joins mid-scroll, and a duplicate would collide as a key.
        setAccountIds((prev) => [
          ...prev,
          ...accounts
            .map((account) => account.id)
            .filter((id) => !prev.includes(id)),
        ]);
        setNextOffset(next);
      })
      .catch(() => {
        // Keep what is shown; pressing Load more again retries.
      })
      .finally(() => {
        if (runId.current === run) setLoadingMore(false);
      });
  }, [dispatch, fetch, loadingMore, nextOffset, query]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  }, []);

  let body: React.ReactNode;
  if (loading) {
    body = <LoadingState />;
  } else if (error) {
    body = <EmptyState title={intl.formatMessage(messages.error)} />;
  } else if (accountIds.length === 0) {
    body = query ? (
      <EmptyState title={intl.formatMessage(messages.noMatch, { query })} />
    ) : (
      <EmptyState title={text.empty} body={text.emptyBody} />
    );
  } else {
    body = (
      <>
        <div className='kommunity-everyone__list'>
          {accountIds.map((id) => (
            <Account key={id} id={id} withMenu={false} />
          ))}
        </div>
        {nextOffset !== null &&
          (loadingMore ? (
            <LoadingState />
          ) : (
            <KornerActionBar align='center'>
              <KornerPill
                label={intl.formatMessage(messages.loadMore)}
                onClick={handleLoadMore}
              />
            </KornerActionBar>
          ))}
      </>
    );
  }

  return (
    <div className='kommunity-everyone'>
      <div className='stage-column'>
        <div className='stage-column__inner'>
          <input
            type='search'
            className='kommunity-everyone__search'
            value={input}
            onChange={handleInput}
            placeholder={text.search}
            aria-label={text.search}
          />
          {body}
        </div>
      </div>
    </div>
  );
};

export const KommunityEveryone: React.FC = () => {
  const intl = useIntl();
  return (
    <KommunityPeopleList
      fetch={apiGetKommunityEveryone}
      text={{
        search: intl.formatMessage(messages.search),
        empty: intl.formatMessage(messages.empty),
        emptyBody: intl.formatMessage(messages.emptyBody),
      }}
    />
  );
};

export const KommunityMates: React.FC = () => {
  const intl = useIntl();
  return (
    <KommunityPeopleList
      fetch={apiGetKommunityMates}
      text={{
        search: intl.formatMessage(messages.matesSearch),
        empty: intl.formatMessage(messages.matesEmpty),
        emptyBody: intl.formatMessage(messages.matesEmptyBody),
      }}
    />
  );
};
