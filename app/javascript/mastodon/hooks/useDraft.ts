import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { DraftComposer } from 'mastodon/api/drafts';
import {
  apiDiscardDraft,
  apiListDrafts,
  apiSaveDraft,
} from 'mastodon/api/drafts';
import type { ApiComposerDraftJSON } from 'mastodon/api_types/drafts';

// useDraft — drafts for any composer (docs/design.md, Drafts).
//
// A composer hands over what it is writing (`params`, plus any finished
// uploads by id), whether there is anything in it yet, and how to put a
// draft back into its fields (`apply`). The hook does the rest:
//
//   - On open it lists this composer's drafts and applies the newest (none,
//     and the composer is left as it opened).
//   - As you write it saves twice: on this device straight away (so a
//     crash, a closed tab or no signal loses nothing) and to the server
//     shortly after (so the draft is on your other devices). Opening
//     again, a device copy newer than the server's wins and is sent up.
//   - Closing saves on the way out. Nothing is lost by closing. A draft goes
//     by Discard, by posting (`finish`), or by being emptied by hand.
//   - Several drafts per composer: `switchTo` one, or `startNew`, which
//     leaves the current one saved.
//
// Saves run one at a time, so a new draft's id is known before the next
// save and a draft is never created twice. Inactive (`active: false`, e.g.
// a composer opened to edit something already posted) it does nothing.
//
// Hand the result to <ComposeShell draft={…}> for the shared Drafts row,
// "Saved" line and Discard confirm.

const LOCAL_PREFIX = 'kronk:drafts:';
const LOCAL_DEBOUNCE = 250;
const SERVER_DEBOUNCE = 1200;

export interface DraftSnapshot<P> {
  params: P;
  // Finished uploads, in order. Uploads still in flight aren't kept.
  mediaIds?: string[];
}

export type DraftStatus = 'idle' | 'saving' | 'saved' | 'offline';

export interface UseDraftOptions<P> extends DraftComposer {
  // Bumped when a composer changes the shape of its params, so `apply`
  // can tell an older draft apart.
  version?: number;
  snapshot: DraftSnapshot<P>;
  // Nothing worth keeping yet: no draft is started until there is.
  hasContent: boolean;
  // Put a draft into the composer's fields; null for a blank composer.
  apply: (draft: ApiComposerDraftJSON<P> | null) => void;
  // A chip's label in the Drafts row, usually the title. Empty or left out,
  // the chip says "Untitled".
  describe?: (draft: ApiComposerDraftJSON<P>) => string | null | undefined;
  active?: boolean;
  // While posting: don't save what is about to be posted.
  paused?: boolean;
  // Something is still on its way (an upload): the Drafts row holds still,
  // so switching or starting another can't drop it.
  locked?: boolean;
}

export interface DraftControls<P = unknown> {
  active: boolean;
  loaded: boolean;
  drafts: ApiComposerDraftJSON<P>[];
  currentId: string | null;
  status: DraftStatus;
  hasContent: boolean;
  locked: boolean;
  describe: (draft: ApiComposerDraftJSON<P>) => string | null | undefined;
  switchTo: (draft: ApiComposerDraftJSON<P>) => void;
  startNew: () => void;
  // Delete the current draft and blank the composer. Confirm first (the
  // shell's Discard does).
  discard: () => void;
  // Save now; resolves when the server has it (or has failed to).
  flush: () => Promise<void>;
  // After posting: the draft is done with. Deletes it; does not blank.
  finish: () => void;
}

interface LocalCopy<P> {
  id: string | null;
  savedAt: number;
  version: number;
  params: P;
  mediaIds: string[];
}

const localKey = ({ korner, kind, context }: DraftComposer) =>
  `${LOCAL_PREFIX}${korner}:${kind}:${context ?? ''}`;

function readLocal<P>(key: string): LocalCopy<P> | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as LocalCopy<P>) : null;
  } catch {
    return null;
  }
}

function writeLocal(key: string, copy: LocalCopy<unknown> | null) {
  try {
    if (copy) window.localStorage.setItem(key, JSON.stringify(copy));
    else window.localStorage.removeItem(key);
  } catch {
    // Storage full or blocked: the server copy still saves.
  }
}

// A device copy newer than the server's version of the same draft (or one
// the server never got) is laid over it: its fields, and of the server's
// uploads those it still lists, in its order.
function mergeLocal<P>(
  list: ApiComposerDraftJSON<P>[],
  local: LocalCopy<P> | null,
  composer: DraftComposer,
): { list: ApiComposerDraftJSON<P>[]; dirty: ApiComposerDraftJSON<P> | null } {
  if (!local) return { list, dirty: null };
  const server = local.id ? list.find((d) => d.id === local.id) : undefined;
  if (local.id && !server) return { list, dirty: null }; // discarded elsewhere
  if (server && Date.parse(server.updated_at) >= local.savedAt) {
    return { list, dirty: null };
  }

  const byId = new Map(server?.media_attachments.map((m) => [m.id, m]) ?? []);
  const merged: ApiComposerDraftJSON<P> = {
    id: server?.id ?? '',
    korner: composer.korner,
    kind: composer.kind,
    context: composer.context ?? null,
    version: local.version,
    params: local.params,
    media_attachments: local.mediaIds.flatMap((id) => {
      const m = byId.get(id);
      return m ? [m] : [];
    }),
    updated_at: new Date(local.savedAt).toISOString(),
  };
  return {
    list: [merged, ...list.filter((d) => d.id !== server?.id)],
    dirty: merged,
  };
}

const noDescription = () => null;

export function useDraft<P>(options: UseDraftOptions<P>): DraftControls<P> {
  const {
    korner,
    kind,
    context = null,
    version = 1,
    snapshot,
    hasContent,
    describe = noDescription,
    active = true,
    paused = false,
    locked = false,
  } = options;

  const composer = useMemo(
    () => ({ korner, kind, context }),
    [korner, kind, context],
  );
  const key = localKey(composer);

  const applyRef = useRef(options.apply);
  applyRef.current = options.apply;

  const [drafts, setDrafts] = useState<ApiComposerDraftJSON<P>[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!active);
  const [status, setStatus] = useState<DraftStatus>('idle');

  const currentIdRef = useRef<string | null>(null);
  const lastSentRef = useRef('');
  const pendingRef = useRef<DraftSnapshot<P> | null>(null);
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  // `forget`, for the save effect, which comes before it.
  const forgetRef = useRef<() => void>(() => undefined);
  // Bumped when the draft open is forgotten (discarded or posted): a save
  // still on its way then is thrown away rather than kept.
  const forgetsRef = useRef(0);

  const setCurrent = useCallback((id: string | null) => {
    currentIdRef.current = id;
    setCurrentId(id);
  }, []);

  const body = useCallback(
    (s: DraftSnapshot<P>) => ({
      version,
      params: s.params,
      media_ids: s.mediaIds ?? [],
    }),
    [version],
  );

  // Send what's pending to the server, after any save already under way.
  const flush = useCallback(() => {
    const next = pendingRef.current;
    if (!next) return chainRef.current;
    pendingRef.current = null;

    const forgets = forgetsRef.current;
    chainRef.current = chainRef.current.then(async () => {
      if (forgets !== forgetsRef.current) return;
      const payload = body(next);
      const json = JSON.stringify(payload);
      if (json === lastSentRef.current && currentIdRef.current) return;
      setStatus('saving');
      try {
        const saved = await apiSaveDraft<P>(
          currentIdRef.current,
          composer,
          payload,
        );
        if (forgets !== forgetsRef.current) {
          await apiDiscardDraft(saved.id);
          return;
        }
        lastSentRef.current = json;
        setCurrent(saved.id);
        setDrafts((prev) => [saved, ...prev.filter((d) => d.id !== saved.id)]);
        // The server has it now; the device copy only needs the id.
        const local = readLocal<P>(key);
        if (
          local &&
          JSON.stringify(local.params) === JSON.stringify(next.params)
        ) {
          writeLocal(key, {
            ...local,
            id: saved.id,
            savedAt: Date.parse(saved.updated_at),
          });
        }
        setStatus('saved');
      } catch {
        // Kept on this device; sent up next time the composer opens.
        setStatus('offline');
      }
    });
    return chainRef.current;
  }, [body, composer, key, setCurrent]);

  // Open: this composer's drafts, the newest applied.
  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    const local = readLocal<P>(key);

    void apiListDrafts<P>(composer)
      .catch(() => [] as ApiComposerDraftJSON<P>[])
      .then((list) => {
        if (cancelled) return undefined;
        const { list: merged, dirty } = mergeLocal(list, local, composer);
        setDrafts(merged.filter((d) => d.id !== ''));
        // Only a draft is applied: a composer opens blank already, and may
        // hold something it was opened with (a mention, a quote).
        const first = merged[0] ?? null;
        if (first) applyRef.current(first);
        // A device copy the server never got has no id yet.
        setCurrent(first && first.id !== '' ? first.id : null);
        if (dirty) {
          pendingRef.current = {
            params: dirty.params,
            mediaIds: dirty.media_attachments.map((m) => m.id),
          };
          void flush();
        }
        return undefined;
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
    // Once per composer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key]);

  // As you write: the device copy almost at once, the server's after a
  // pause.
  const serialized = JSON.stringify(snapshot);
  useEffect(() => {
    if (!active || !loaded || paused) return undefined;
    // Nothing in it: nothing to keep. A draft emptied by hand goes, after
    // the same pause as a save, so what was deleted doesn't come back next
    // time.
    if (!hasContent) {
      if (!currentIdRef.current) return undefined;
      const emptiedTimer = window.setTimeout(() => {
        forgetRef.current();
      }, SERVER_DEBOUNCE);
      return () => {
        window.clearTimeout(emptiedTimer);
      };
    }

    const localTimer = window.setTimeout(() => {
      writeLocal(key, {
        id: currentIdRef.current,
        savedAt: Date.now(),
        version,
        params: snapshot.params,
        mediaIds: snapshot.mediaIds ?? [],
      });
    }, LOCAL_DEBOUNCE);

    pendingRef.current = snapshot;
    const serverTimer = window.setTimeout(() => void flush(), SERVER_DEBOUNCE);

    return () => {
      window.clearTimeout(localTimer);
      window.clearTimeout(serverTimer);
    };
    // `serialized` stands in for `snapshot`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, loaded, paused, hasContent, serialized, key, version, flush]);

  // Closing the composer, or the tab: save on the way out.
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const hasContentRef = useRef(hasContent);
  hasContentRef.current = hasContent;

  useEffect(() => {
    if (!active) return undefined;
    const onPageHide = () => {
      if (!hasContentRef.current) return;
      writeLocal(key, {
        id: currentIdRef.current,
        savedAt: Date.now(),
        version,
        params: snapshotRef.current.params,
        mediaIds: snapshotRef.current.mediaIds ?? [],
      });
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      void flush();
    };
  }, [active, key, version, flush]);

  const load = useCallback(
    (draft: ApiComposerDraftJSON<P> | null) => {
      pendingRef.current = null;
      lastSentRef.current = '';
      writeLocal(key, null);
      applyRef.current(draft);
      setCurrent(draft?.id ?? null);
      setStatus('idle');
    },
    [key, setCurrent],
  );

  // Save this one first, then open the other.
  const switchTo = useCallback(
    (draft: ApiComposerDraftJSON<P>) => {
      if (hasContentRef.current) pendingRef.current = snapshotRef.current;
      void flush().then(() => {
        load(draft);
        return undefined;
      });
    },
    [flush, load],
  );

  const startNew = useCallback(() => {
    if (hasContentRef.current) pendingRef.current = snapshotRef.current;
    void flush().then(() => {
      load(null);
      return undefined;
    });
  }, [flush, load]);

  // Inactive (editing something already posted), there is no draft to
  // forget, and the device copy of a new one is left alone.
  const activeRef = useRef(active);
  activeRef.current = active;

  const forget = useCallback(() => {
    if (!activeRef.current) return;
    const id = currentIdRef.current;
    forgetsRef.current += 1;
    pendingRef.current = null;
    writeLocal(key, null);
    setCurrent(null);
    setStatus('idle');
    if (!id) return;
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    void chainRef.current
      .then(() => apiDiscardDraft(id))
      .catch(() => {
        // Left behind, it's a draft you can discard later.
      });
  }, [key, setCurrent]);

  forgetRef.current = forget;

  const discard = useCallback(() => {
    forget();
    applyRef.current(null);
  }, [forget]);

  return {
    active,
    loaded,
    drafts,
    currentId,
    status,
    hasContent,
    locked,
    describe,
    switchTo,
    startNew,
    discard,
    flush,
    finish: forget,
  };
}
