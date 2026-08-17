import { useCallback, useEffect, useState } from 'react';

// pieces_store — a tiny localStorage-backed cache for user-composed
// Art pieces, standing in for the eventual Art::Piece backend.
//
// The composer at /hub/art/composer writes pieces here on submit; the
// browse view (features/art/index.tsx) reads via `useUserPieces` and
// merges them onto the top of each shelf strip so a user's own
// submissions show up immediately after posting AND persist across
// reloads.
//
// When the backend lands this file gets replaced by an API-driven
// slice; the shape of `StoredPiece` is a subset of the intended
// server payload so the swap is one-for-one at the consumer side.

const STORAGE_KEY = 'kronk.art.pieces';
const CHANGE_EVENT = 'kronk-art-pieces:change';

export interface StoredPiece {
  key: string;
  houseKey: string;
  shelfKey: string;
  title: string;
  description: string;
  author: string;
  publishedAt: string;
  topic: string;
  visibility: string;
  // Zero-or-more attached media filenames. Multi-select mirrors the
  // Albutts composer that Art is subsuming (Tal 2026-08-17). The
  // filenames are the payload until the backend accepts real
  // uploads; then this becomes an array of media ids.
  mediaNames?: string[];
}

const isStoredPiece = (v: unknown): v is StoredPiece => {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.key === 'string' &&
    typeof p.houseKey === 'string' &&
    typeof p.shelfKey === 'string' &&
    typeof p.title === 'string' &&
    typeof p.description === 'string' &&
    typeof p.author === 'string' &&
    typeof p.publishedAt === 'string' &&
    typeof p.topic === 'string' &&
    typeof p.visibility === 'string' &&
    (p.mediaNames === undefined ||
      (Array.isArray(p.mediaNames) &&
        p.mediaNames.every((n) => typeof n === 'string')))
  );
};

export const readPieces = (): StoredPiece[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStoredPiece);
  } catch {
    // Malformed JSON / storage unavailable → treat as empty.
    return [];
  }
};

const writePieces = (pieces: StoredPiece[]): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pieces));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Storage quota / access denied — silently drop for MVP.
  }
};

// Prepend a new piece so it shows up at the top of its shelf strip.
export const addPiece = (piece: StoredPiece): void => {
  const existing = readPieces();
  writePieces([piece, ...existing]);
};

// React hook — returns the current pieces list and re-renders on
// change (from this window OR another tab via the native `storage`
// event). Used by the browse view to merge user submissions into
// the mock strip.
export const useUserPieces = (): StoredPiece[] => {
  const [pieces, setPieces] = useState<StoredPiece[]>(() => readPieces());

  const refresh = useCallback(() => {
    setPieces(readPieces());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) refresh();
    };
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, [refresh]);

  return pieces;
};
