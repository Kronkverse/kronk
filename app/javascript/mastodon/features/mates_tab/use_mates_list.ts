import { useCallback, useEffect, useRef, useState } from 'react';

import { importFetchedAccounts } from 'mastodon/actions/importer';
import api, { apiRequestGet, getLinks } from 'mastodon/api';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import { useAppDispatch } from 'mastodon/store';

// Live fetch of one account's Mates — the mutual-follow list behind
// `/@:acct/mates`.
//
// Endpoint: `GET /api/v1/accounts/:id/mates`
// (app/controllers/api/v1/accounts/mates_controller.rb). The route takes an
// account id and the page only knows a handle, so this resolves the handle
// through `accounts/lookup` first — the same two-step `features/connections`
// used.
//
// Fetched accounts are pushed into the Redux account store and the hook
// returns ids only. That is what lets the list render with the shared
// `<Account>` row: it selects the account out of the store by id and brings
// the relationship button, the menu and the badges with it, instead of the
// page hand-rolling avatar-and-name markup of its own.
//
// Staleness is tracked with a run counter rather than a `cancelled` flag.
// Every fetch stamps the run it belongs to and drops its result if the
// counter has moved on, which covers both cases a boolean would miss: a
// second subject arriving while the first is in flight, and two `loadMore`
// pages resolving out of order.

interface UseMatesListResult {
  accountIds: string[];
  subject: ApiAccountJSON | null;
  loading: boolean;
  // True while a `loadMore()` page is in flight, so the caller can show a
  // footer spinner without blanking the rows it already has.
  loadingMore: boolean;
  error: unknown;
  hasMore: boolean;
  loadMore: () => void;
}

export const useMatesList = (acct?: string): UseMatesListResult => {
  const dispatch = useAppDispatch();
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [subject, setSubject] = useState<ApiAccountJSON | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // `null` = no further page. Held in a ref rather than state because
  // `loadMore` must read the newest value without being re-created (and so
  // re-triggering) on every page.
  const nextMaxId = useRef<string | null>(null);
  const runId = useRef(0);

  const fetchPage = useCallback(
    async (accountId: string, maxId?: string) => {
      // `api()` rather than `apiRequestGet` — the latter returns the body
      // only, and pagination needs the response's Link header.
      const response = await api().get<ApiAccountJSON[]>(
        `/api/v1/accounts/${accountId}/mates`,
        { params: maxId ? { max_id: maxId } : undefined },
      );
      const accounts = response.data;
      dispatch(importFetchedAccounts(accounts));

      // `max_id` for the next page comes from the Link header, which
      // paginates on Follow row ids — the account ids in the body are not
      // the cursor and must not be used as one.
      const next = getLinks(response).refs.find((link) => link.rel === 'next');
      const cursor = next ? new URL(next.uri).searchParams.get('max_id') : null;

      return { ids: accounts.map((account) => account.id), cursor };
    },
    [dispatch],
  );

  useEffect(() => {
    if (!acct) return;

    runId.current += 1;
    const run = runId.current;

    setLoading(true);
    setError(null);
    setAccountIds([]);
    nextMaxId.current = null;

    void (async () => {
      try {
        const account = await apiRequestGet<ApiAccountJSON>(
          'v1/accounts/lookup',
          { acct },
        );
        if (runId.current !== run) return;
        setSubject(account);

        const { ids, cursor } = await fetchPage(account.id);
        if (runId.current !== run) return;
        nextMaxId.current = cursor;
        setAccountIds(ids);
      } catch (err: unknown) {
        if (runId.current === run) setError(err);
      } finally {
        if (runId.current === run) setLoading(false);
      }
    })();
  }, [acct, fetchPage]);

  const loadMore = useCallback(() => {
    const maxId = nextMaxId.current;
    if (!subject || !maxId || loadingMore) return;

    const run = runId.current;
    setLoadingMore(true);

    void (async () => {
      try {
        const { ids, cursor } = await fetchPage(subject.id, maxId);
        if (runId.current !== run) return;
        nextMaxId.current = cursor;
        // Concatenate rather than replace, and drop any id already held —
        // a Mates list can shift under a cursor if a follow is removed
        // mid-scroll, and a duplicate id would collide as a React key.
        setAccountIds((prev) => [
          ...prev,
          ...ids.filter((id) => !prev.includes(id)),
        ]);
      } catch (err: unknown) {
        if (runId.current === run) setError(err);
      } finally {
        if (runId.current === run) setLoadingMore(false);
      }
    })();
  }, [subject, loadingMore, fetchPage]);

  return {
    accountIds,
    subject,
    loading,
    loadingMore,
    error,
    hasMore: nextMaxId.current !== null,
    loadMore,
  };
};
