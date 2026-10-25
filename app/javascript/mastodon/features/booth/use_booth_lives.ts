import { useCallback, useEffect, useState } from 'react';

import api from 'mastodon/api';

import type { BoothLive } from './types';

// What's live now and coming up (`GET /api/v1/booth_lives`), refreshed
// every minute so a set that starts while you're on the page shows up.

const REFRESH_MS = 60_000;

export function useBoothLives(): {
  lives: BoothLive[];
  loading: boolean;
  replace: (live: BoothLive) => void;
} {
  const [lives, setLives] = useState<BoothLive[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api()
        .get<BoothLive[]>('/api/v1/booth_lives')
        .then((res) => {
          if (!cancelled) setLives(res.data);
          return undefined;
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const replace = useCallback((updated: BoothLive) => {
    setLives((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  }, []);

  return { lives, loading, replace };
}
