import { useCallback, useEffect, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import { apiRequestGet } from 'mastodon/api';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import { Avatar } from 'mastodon/components/avatar';
import { LoadingIndicator } from 'mastodon/components/loading_indicator';
import { createAccountFromServerJSON } from 'mastodon/models/account';

// Kommunity Discover — the list surface. Fetches accounts the viewer
// is allowed to see per each account's own
// `kommunity_discoverability` (backend gate), ordered by recent
// activity. Tap a row → `/@:acct/shelves` where Mate + Nudge live
// on the shelved profile header (`ProfileViewerActions`, #1138).
//
// v1 is a simple paginated grid: 40 accounts per fetch, "Load more"
// button at the bottom. Infinite scroll can layer on later; the
// deliberate stop-and-load reads well as a browsing pace for a
// discovery surface (vs. a firehose).

const PAGE_SIZE = 40;

const messages = defineMessages({
  header: {
    id: 'kommunity.discover.header',
    defaultMessage: 'Discover Kronkers',
  },
  loadMore: {
    id: 'kommunity.discover.load_more',
    defaultMessage: 'Load more',
  },
  loadingMore: {
    id: 'kommunity.discover.loading_more',
    defaultMessage: 'Loading\u2026',
  },
  empty: {
    id: 'kommunity.discover.empty',
    defaultMessage: 'No one to discover yet.',
  },
  error: {
    id: 'kommunity.discover.error',
    defaultMessage: 'Could not load the list.',
  },
});

export const KommunityDiscover: React.FC = () => {
  const intl = useIntl();
  const [accounts, setAccounts] = useState<ApiAccountJSON[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchPage = useCallback(async (maxId: string | null) => {
    const params: Record<string, string> = { limit: String(PAGE_SIZE) };
    if (maxId) params.max_id = maxId;
    return apiRequestGet<ApiAccountJSON[]>('v1/kommunity/discover', params);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setHasMore(true);
    fetchPage(null)
      .then((data) => {
        if (cancelled) return;
        setAccounts(data);
        setHasMore(data.length >= PAGE_SIZE);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    const last = accounts.at(-1);
    if (!last) return;
    setLoadingMore(true);
    fetchPage(last.id)
      .then((data) => {
        setAccounts((prev) => [...prev, ...data]);
        setHasMore(data.length >= PAGE_SIZE);
      })
      .catch(() => {
        // Preserve what we already have; user can retry.
      })
      .finally(() => {
        setLoadingMore(false);
      });
  }, [accounts, fetchPage, hasMore, loadingMore]);

  if (loading) {
    return (
      <div className='kommunity-discover__loading'>
        <LoadingIndicator />
      </div>
    );
  }

  if (error) {
    return (
      <div className='kommunity-discover__empty'>
        {intl.formatMessage(messages.error)}
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className='kommunity-discover__empty'>
        {intl.formatMessage(messages.empty)}
      </div>
    );
  }

  return (
    <div className='kommunity-discover'>
      <h2 className='kommunity-discover__header'>
        <FormattedMessage {...messages.header} />
      </h2>

      <ul className='kommunity-discover__grid'>
        {accounts.map((account) => (
          <DiscoverRow key={account.id} account={account} />
        ))}
      </ul>

      {hasMore && (
        <div className='kommunity-discover__more'>
          <button
            type='button'
            className='kommunity-discover__more-btn'
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore
              ? intl.formatMessage(messages.loadingMore)
              : intl.formatMessage(messages.loadMore)}
          </button>
        </div>
      )}
    </div>
  );
};

const DiscoverRow: React.FC<{ account: ApiAccountJSON }> = ({ account }) => {
  const modelAccount = createAccountFromServerJSON(account);
  const name = account.display_name || account.username;
  return (
    <li className='kommunity-discover__row'>
      <Link
        to={`/@${account.acct}/shelves`}
        className='kommunity-discover__link'
      >
        <Avatar account={modelAccount} size={48} />
        <div className='kommunity-discover__names'>
          <div className='kommunity-discover__dname'>{name}</div>
          <div className='kommunity-discover__handle'>@{account.acct}</div>
        </div>
      </Link>
    </li>
  );
};
