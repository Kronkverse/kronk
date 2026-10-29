import { useCallback, useEffect, useState } from 'react';

import api from 'mastodon/api';

import type { BoothSet } from './types';

// The newest published sets in one request, for Musik's By artist and By
// kind rows (`limit`, MAX_LIMIT in the controller). The rows are drawn from
// these; each row's See all opens the full list.

const SHELF_WINDOW = 200;

export function useBoothShelves(): {
  sets: BoothSet[];
  loading: boolean;
  replace: (set: BoothSet) => void;
  remove: (id: string) => void;
} {
  const [sets, setSets] = useState<BoothSet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api()
      .get<BoothSet[]>('/api/v1/booth_sets', {
        params: { limit: SHELF_WINDOW },
      })
      .then((res) => {
        if (!cancelled) setSets(res.data);
      })
      .catch(() => {
        if (!cancelled) setSets([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const replace = useCallback((set: BoothSet) => {
    setSets((all) => all.map((s) => (s.id === set.id ? set : s)));
  }, []);
  const remove = useCallback((id: string) => {
    setSets((all) => all.filter((s) => s.id !== id));
  }, []);

  return { sets, loading, replace, remove };
}
