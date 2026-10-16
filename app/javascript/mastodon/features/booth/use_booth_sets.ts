import { useCallback, useEffect, useRef, useState } from 'react';

import api from 'mastodon/api';

import type { BoothSet } from './types';

// Published sets, newest first, a page at a time
// (`GET /api/v1/booth_sets`, PAGE_SIZE in the controller). `query`
// matches title, credit line and genres; `genre` is one exact tag.
// Changing either starts again from the first page.

const PAGE_SIZE = 40;

interface Filters {
  query?: string;
  genre?: string | null;
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
}: Filters = {}): BoothSetsState {
  const [sets, setSets] = useState<BoothSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  // Which search the grid is showing. A page that comes back for an
  // earlier one is dropped rather than added to the new results.
  const search = useRef(0);

  const fetchPage = useCallback(
    (maxId?: string) =>
      api()
        .get<BoothSet[]>('/api/v1/booth_sets', {
          params: {
            q: query || undefined,
            genre: genre ?? undefined,
            max_id: maxId,
          },
        })
        .then((res) => res.data),
    [query, genre],
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
  const loadMore = useCallback(() => {
    if (!lastId) return;
    const asked = search.current;
    setLoadingMore(true);
    fetchPage(lastId)
      .then((page) => {
        if (asked !== search.current) return;
        setSets((prev) => [...prev, ...page]);
        setHasMore(page.length === PAGE_SIZE);
        setLoadingMore(false);
      })
      .catch(() => {
        if (asked === search.current) setLoadingMore(false);
      });
  }, [fetchPage, lastId]);

  const replace = useCallback((updated: BoothSet) => {
    setSets((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }, []);

  const remove = useCallback((id: string) => {
    setSets((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { sets, loading, loadingMore, hasMore, loadMore, replace, remove };
}
