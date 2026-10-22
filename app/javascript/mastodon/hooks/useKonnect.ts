import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useLocation } from 'react-router-dom';

import {
  apiCreateAttachment,
  apiSearchAttachmentCandidates,
} from 'mastodon/api/attachments';

// useKonnect — a composer's Konnections (docs/design.md, Platform
// primitives; docs/korners/adding_a_korner.md, Korner attachments §4.4).
//
// Any creation Konnects to any other (decisions.md, 2026-10-23). A composer
// can't Konnect what it makes until it has made it, so it holds them here
// while the person writes:
//
//   - `?konnect=<slug>:<id>` (the Konnect picker's "New …", from any
//     record) arrives as the first one, `source`. The older `?krew=<id>`
//     reads as `krew:<id>`.
//   - The person adds more with the Konnect row `<ComposeShell konnect={…}>`
//     draws (its picker returns a record rather than saving a link) and
//     drops any with its ×.
//   - After the create succeeds the composer calls `commit(slug, id)`,
//     which Konnects the new record to each. A link that fails is collected
//     and returned, never thrown: the record is made either way.
//
// A composer that already Konnects the source its own way (an album made
// for a Krew is the Krew's album) passes `sourceHandled`: the tile shows,
// can't be dropped, and `commit` leaves it to the composer.

export interface KonnectTarget {
  slug: string;
  id: string;
  title?: string | null;
}

export interface KonnectFailure {
  target: KonnectTarget;
  error: unknown;
}

export interface KonnectControls {
  // The composer's korner: what the picker offers is what it can Konnect to.
  korner: string;
  // The record the composer was opened for (`?konnect=`), if any.
  source: KonnectTarget | null;
  // Every Konnection waiting for the record to exist, the source first.
  pending: KonnectTarget[];
  // Whether a pending one can be dropped (not a handled source).
  removable: (target: KonnectTarget) => boolean;
  add: (target: KonnectTarget) => void;
  remove: (target: Pick<KonnectTarget, 'slug' | 'id'>) => void;
  // Put a draft's Konnections back (the source stays). Null or undefined
  // leaves only the source.
  restore: (saved: KonnectTarget[] | null | undefined) => void;
  // What a draft keeps: the pending ones the composer doesn't handle.
  saved: KonnectTarget[];
  // Konnect the record just made to each pending one.
  commit: (createdSlug: string, createdId: string) => Promise<KonnectFailure[]>;
}

export interface UseKonnectOptions {
  sourceHandled?: boolean;
}

// `?konnect=<slug>:<id>`, or the older `?krew=<id>`.
export const parseKonnectParam = (search: string): KonnectTarget | null => {
  const params = new URLSearchParams(search);
  const raw = params.get('konnect');
  if (raw) {
    const at = raw.indexOf(':');
    if (at <= 0 || at === raw.length - 1) return null;
    return { slug: raw.slice(0, at), id: raw.slice(at + 1) };
  }
  const krew = params.get('krew');
  return krew ? { slug: 'krew', id: krew } : null;
};

// The search a composer is opened with to Konnect what it makes to a record.
export const konnectSearch = (slug: string, id: string | number) =>
  `?konnect=${encodeURIComponent(slug)}:${encodeURIComponent(String(id))}`;

const same = (
  a: Pick<KonnectTarget, 'slug' | 'id'>,
  b: Pick<KonnectTarget, 'slug' | 'id'>,
) => a.slug === b.slug && a.id === b.id;

export const useKonnect = (
  korner: string,
  { sourceHandled = false }: UseKonnectOptions = {},
): KonnectControls => {
  const { search } = useLocation();
  const parsed = useMemo(() => parseKonnectParam(search), [search]);
  const sourceSlug = parsed?.slug;
  const sourceId = parsed?.id;
  const [sourceTitle, setSourceTitle] = useState<string | null>(null);

  const source = useMemo<KonnectTarget | null>(
    () =>
      sourceSlug && sourceId
        ? { slug: sourceSlug, id: sourceId, title: sourceTitle }
        : null,
    [sourceSlug, sourceId, sourceTitle],
  );

  // The source's title, for its tile: the URL carries only its id.
  useEffect(() => {
    setSourceTitle(null);
    if (!sourceSlug || !sourceId) return undefined;
    let cancelled = false;
    apiSearchAttachmentCandidates(sourceSlug, '', 1, false, sourceId)
      .then((rows) => {
        if (!cancelled) setSourceTitle(rows[0]?.title ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [sourceSlug, sourceId]);

  // The ones the person added, apart from the source.
  const [added, setAdded] = useState<KonnectTarget[]>([]);

  const pending = useMemo(() => {
    const list = source ? [source] : [];
    added.forEach((t) => {
      if (!list.some((p) => same(p, t))) list.push(t);
    });
    return list;
  }, [source, added]);

  // A dropped source stays dropped (unless the composer handles it).
  const [sourceDropped, setSourceDropped] = useState(false);
  const visible = useMemo(
    () =>
      sourceDropped && source
        ? pending.filter((t) => !same(t, source))
        : pending,
    [pending, source, sourceDropped],
  );

  const sourceRef = useRef(source);
  sourceRef.current = source;

  const removable = useCallback(
    (target: KonnectTarget) =>
      !(sourceHandled && sourceRef.current && same(target, sourceRef.current)),
    [sourceHandled],
  );

  const add = useCallback(
    (target: KonnectTarget) => {
      if (sourceRef.current && same(target, sourceRef.current)) {
        setSourceDropped(false);
        return;
      }
      if (target.slug === korner) return; // a link joins two korners
      setAdded((prev) =>
        prev.some((p) => same(p, target)) ? prev : [...prev, target],
      );
    },
    [korner],
  );

  const remove = useCallback(
    (target: Pick<KonnectTarget, 'slug' | 'id'>) => {
      if (sourceRef.current && same(target, sourceRef.current)) {
        if (!sourceHandled) setSourceDropped(true);
        return;
      }
      setAdded((prev) => prev.filter((p) => !same(p, target)));
    },
    [sourceHandled],
  );

  const restore = useCallback(
    (saved: KonnectTarget[] | null | undefined) => {
      setSourceDropped(false);
      setAdded(
        (saved ?? []).filter(
          (t) =>
            t.slug !== korner &&
            !(sourceRef.current && same(t, sourceRef.current)),
        ),
      );
    },
    [korner],
  );

  const toCommit = useMemo(
    () => visible.filter((t) => !(sourceHandled && source && same(t, source))),
    [visible, sourceHandled, source],
  );

  const commit = useCallback(
    async (createdSlug: string, createdId: string) => {
      const results = await Promise.allSettled(
        toCommit
          .filter((t) => t.slug !== createdSlug)
          .map(async (target) => {
            try {
              await apiCreateAttachment({
                source_slug: createdSlug,
                source_id: createdId,
                target_slug: target.slug,
                target_id: target.id,
                kind: 'link',
              });
              return null;
            } catch (error) {
              return { target, error };
            }
          }),
      );
      return results.flatMap((r) =>
        r.status === 'fulfilled' && r.value ? [r.value] : [],
      );
    },
    [toCommit],
  );

  return {
    korner,
    source,
    pending: visible,
    removable,
    add,
    remove,
    restore,
    saved: toCommit,
    commit,
  };
};
