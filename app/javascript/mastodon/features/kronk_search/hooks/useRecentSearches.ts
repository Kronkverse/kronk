import { useCallback, useEffect, useState } from 'react';

// Kronk Search recent-searches — persisted client-side only per spec
// §"Query logging". Never sent to the server. localStorage is scoped
// to the current origin (the Kronk instance).
//
// Keeps the most-recent N queries (default 8) so the search overlay
// can offer a "did you mean these recent things?" hint.

const STORAGE_KEY = 'kronk:search:recent';
const MAX_RECENT = 8;

const readStore = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((q): q is string => typeof q === 'string')
      : [];
  } catch {
    return [];
  }
};

const writeStore = (queries: string[]) => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(queries.slice(0, MAX_RECENT)),
    );
  } catch {
    // Best-effort; localStorage may be disabled or full.
  }
};

export const useRecentSearches = () => {
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setRecent(readStore());
  }, []);

  const record = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setRecent((prev) => {
      const next = [trimmed, ...prev.filter((q) => q !== trimmed)].slice(
        0,
        MAX_RECENT,
      );
      writeStore(next);
      return next;
    });
  }, []);

  const forget = useCallback((query: string) => {
    setRecent((prev) => {
      const next = prev.filter((q) => q !== query);
      writeStore(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    writeStore([]);
    setRecent([]);
  }, []);

  return { recent, record, forget, clear };
};
