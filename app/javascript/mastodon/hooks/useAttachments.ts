import { useCallback, useEffect, useState } from 'react';

import type {
  ApiAttachmentJSON,
  AttachmentKind,
} from 'mastodon/api/attachments';
import {
  apiCreateAttachment,
  apiDeleteAttachment,
  apiGetAttachmentsBySource,
} from 'mastodon/api/attachments';

// useAttachments — the client half of the KornerAttachment primitive
// (docs/kronk_korner_attachments.md §4.1). Reads a source record's
// attachments and exposes add / remove helpers. `<AttachmentSection>`
// is the primary consumer; adopt this hook directly if the surface
// needs custom rendering (rare — prefer the shared component).
//
// Phase 2: read + write link/reference; spawn attachments are
// framework-only (created by the server-side factory in Phase 3) so
// the hook doesn't expose an `addSpawn`. If a caller mutates the
// underlying record in a way the server responds to with a new spawn
// (e.g. a Kalendar composer's `spawn_album`), call `refresh()` after
// the record save to pull the newly-materialised row in.
//
// Best-effort error handling matches `useAvailableKrews`: on failure
// the list is empty and the surface stays usable. Real errors surface
// via the `error` return so callers can render a state banner if they
// want to.

interface UseAttachmentsResult {
  attached: ApiAttachmentJSON[];
  loading: boolean;
  error: unknown;
  addLink: (
    targetSlug: string,
    targetId: string,
    kind?: Exclude<AttachmentKind, 'spawn'>,
    metadata?: Record<string, unknown>,
  ) => Promise<ApiAttachmentJSON | null>;
  removeLink: (attachmentId: string) => Promise<void>;
  refresh: () => void;
}

export const useAttachments = (
  sourceSlug: string,
  sourceId: string | number | null | undefined,
): UseAttachmentsResult => {
  const [attached, setAttached] = useState<ApiAttachmentJSON[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<unknown>(null);
  const [tick, setTick] = useState(0);

  const idStr = sourceId == null ? null : String(sourceId);

  useEffect(() => {
    if (!idStr) {
      setAttached([]);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const list = await apiGetAttachmentsBySource(sourceSlug, idStr);
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- `cancelled` mutates in cleanup after the await; TS can't see it across the closure.
        if (cancelled) return;
        setAttached(list);
      } catch (e) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- see comment above.
        if (cancelled) return;
        setError(e);
        setAttached([]);
      } finally {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- see comment above.
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sourceSlug, idStr, tick]);

  const refresh = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  const addLink = useCallback(
    async (
      targetSlug: string,
      targetId: string,
      kind: Exclude<AttachmentKind, 'spawn'> = 'link',
      metadata?: Record<string, unknown>,
    ) => {
      if (!idStr) return null;

      const created = await apiCreateAttachment({
        source_slug: sourceSlug,
        source_id: idStr,
        target_slug: targetSlug,
        target_id: targetId,
        kind,
        metadata,
      });
      setAttached((prev) => [created, ...prev]);
      return created;
    },
    [sourceSlug, idStr],
  );

  const removeLink = useCallback(async (attachmentId: string) => {
    await apiDeleteAttachment(attachmentId);
    setAttached((prev) => prev.filter((a) => a.id !== attachmentId));
  }, []);

  return { attached, loading, error, addLink, removeLink, refresh };
};
