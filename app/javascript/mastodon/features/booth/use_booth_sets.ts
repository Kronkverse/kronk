import { useCallback, useEffect, useRef, useState } from 'react';

import api from 'mastodon/api';

import type { BoothKind, BoothSet } from './types';

// Sets a page at a time (`GET /api/v1/booth_sets`, PAGE_SIZE in the
// controller). `query` matches title, credit line and genres; `genre` and
// `kind` are exact; `sort` is the listener's choice. `scope` picks whose
// sets: everyone's published ones, your own (drafts included) or the ones
// you saved; `firstListens` narrows to recent sets with few listens.
// Changing any of these starts again from the first page.
// Newest pages back from the last id; the other orders page by offset.

const PAGE_SIZE = 40;

export type BoothSort = 'newest' | 'fewest' | 'longest';

interface Filters {
  query?: string;
  genre?: string | null;
  kind?: BoothKind | null;
  sort?: BoothSort;
  scope?: 'all' | 'mine' | 'saved';
  // Recent sets that have barely been heard yet, not your own.
  firstListens?: boolean;
}

export interface BoothSetsState {
  sets: BoothSet[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  replace: (set: BoothSet) => void;
  remove: (id: string) => void;
}

export function useBoothSets({
  query = '',
  genre = null,
  kind = null,
  sort = 'newest',
  scope = 'all',
  firstListens = false,
}: Filters = {}): BoothSetsState {
  const [sets, setSets] = useState<BoothSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  // Which search the grid is showing. A page that comes back for an
  // earlier one is dropped rather than added to the new results.
  const search = useRef(0);

  const fetchPage = useCallback(
    (after?: { maxId: string; offset: number }) =>
      api()
        .get<BoothSet[]>('/api/v1/booth_sets', {
          params: {
            q: query || undefined,
            genre: genre ?? undefined,
            kind: kind ?? undefined,
            sort: sort === 'newest' ? undefined : sort,
            mine: scope === 'mine' ? true : undefined,
            saved: scope === 'saved' ? true : undefined,
            first_listens: firstListens ? true : undefined,
            max_id: sort === 'newest' ? after?.maxId : undefined,
            offset: sort === 'newest' ? undefined : after?.offset,
          },
        })
        .then((res) => res.data),
    [query, genre, kind, sort, scope, firstListens],
  );

  useEffect(() => {
    let cancelled = false;
    search.current += 1;
    setLoading(true);
    setLoadingMore(false);
    fetchPage()
      .then((page) => {
        if (cancelled) return;
        setSets(page);
        setHasMore(page.length === PAGE_SIZE);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  const lastId = sets.at(-1)?.id;
  const count = sets.length;
  const loadMore = useCallback(() => {
    if (!lastId) return;
    const asked = search.current;
    setLoadingMore(true);
    fetchPage({ maxId: lastId, offset: count })
      .then((page) => {
        if (asked !== search.current) return;
        setSets((prev) => [...prev, ...page]);
        setHasMore(page.length === PAGE_SIZE);
        setLoadingMore(false);
      })
      .catch(() => {
        if (asked === search.current) setLoadingMore(false);
      });
  }, [fetchPage, lastId, count]);

  const replace = useCallback((updated: BoothSet) => {
    setSets((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }, []);

  const remove = useCallback((id: string) => {
    setSets((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { sets, loading, loadingMore, hasMore, loadMore, replace, remove };
}
