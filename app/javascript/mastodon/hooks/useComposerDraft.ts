import { useCallback, useEffect, useRef, useState } from 'react';

// Client-side composer draft persistence (docs/rebuild/decisions.md
// 2026-08-10). Any composer can adopt this to survive an accidental
// navigate-away / refresh / tab-close: it debounce-saves a serialisable
// snapshot of the composer's state to localStorage, restores it once on
// mount, and clears it on submit / discard. Per-device (no backend sync);
// in-flight (not-yet-uploaded) files are not preserved — completed uploads
// travel in the snapshot as their media ids if the composer includes them.

const PREFIX = 'kronk:draft:';
const DEFAULT_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
const DEFAULT_DEBOUNCE = 700;

interface StoredDraft<T> {
  v: 1;
  savedAt: number;
  data: T;
}

interface Options {
  // While false, nothing is persisted and any existing draft is cleared —
  // e.g. there's no meaningful content yet, or the composer is editing an
  // existing post. Flip true once there's content worth preserving.
  enabled: boolean;
  debounceMs?: number;
  maxAgeMs?: number;
}

interface DraftControls {
  // True when a saved draft was restored on mount — drives the
  // "Draft restored" pill.
  restored: boolean;
  savedAt: number | null;
  // Remove the stored draft and hide the pill. Call on a successful submit,
  // or from the pill's Discard action (after the composer resets its state).
  discard: () => void;
}

function readDraft<T>(
  storageKey: string,
  maxAgeMs: number,
): StoredDraft<T> | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      v?: number;
      savedAt?: number;
      data?: T;
    };
    if (parsed.v !== 1 || typeof parsed.savedAt !== 'number') return null;
    if (Date.now() - parsed.savedAt > maxAgeMs) {
      window.localStorage.removeItem(storageKey);
      return null;
    }
    return { v: 1, savedAt: parsed.savedAt, data: parsed.data as T };
  } catch {
    // Malformed JSON, disabled storage, private mode quota, etc.
    return null;
  }
}

export function useComposerDraft<T>(
  key: string,
  snapshot: T,
  onRestore: (data: T) => void,
  options: Options,
): DraftControls {
  const {
    enabled,
    debounceMs = DEFAULT_DEBOUNCE,
    maxAgeMs = DEFAULT_MAX_AGE,
  } = options;
  const storageKey = PREFIX + key;

  const [restored, setRestored] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Keep the latest onRestore without making the mount effect depend on it.
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;

  // Restore once, on mount.
  const didRestore = useRef(false);
  useEffect(() => {
    if (didRestore.current) return;
    didRestore.current = true;
    const found = readDraft<T>(storageKey, maxAgeMs);
    if (found) {
      onRestoreRef.current(found.data);
      setRestored(true);
      setSavedAt(found.savedAt);
    }
    // Run exactly once for this composer instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Serialise up front so identity churn (a fresh snapshot object each
  // render) doesn't retrigger the effect — only real content changes do.
  const serialized = JSON.stringify(snapshot);

  useEffect(() => {
    if (!enabled) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
      return undefined;
    }
    const handle = window.setTimeout(() => {
      try {
        // `serialized` is already the data JSON — embed it directly so we
        // don't re-parse to an `any`.
        window.localStorage.setItem(
          storageKey,
          `{"v":1,"savedAt":${Date.now()},"data":${serialized}}`,
        );
      } catch {
        // quota exceeded / storage disabled — drop silently.
      }
    }, debounceMs);
    return () => {
      window.clearTimeout(handle);
    };
  }, [enabled, serialized, storageKey, debounceMs]);

  const discard = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    setRestored(false);
    setSavedAt(null);
  }, [storageKey]);

  return { restored, savedAt, discard };
}
