import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useLocation } from 'react-router-dom';

import { showAlert } from 'mastodon/actions/alerts';
import type { AttachmentAudienceLookup } from 'mastodon/api/attachments';
import {
  apiCreateAttachment,
  apiGetAttachmentAudience,
  apiSearchAttachmentCandidates,
} from 'mastodon/api/attachments';
import { useRecordName } from 'mastodon/hooks/useRecordName';
import { useAppDispatch } from 'mastodon/store';

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
//     and returned, never thrown: the record is made either way. The
//     person is told which ones failed, in an alert ("Couldn't Konnect the
//     Ember event"), so no composer has to read the failures to say so.
//   - A draft keeps what the person added (`saved`), never the source: a
//     draft opened again without `?konnect=` is not for that record, so it
//     mustn't come back Konnected to it or following its audience.
//
// Each one's audience is looked up as it arrives (`audiences`, for its
// tile's marker and for "Same as": `useSameAs` lets the composer's reach
// follow one of them, its `leader`, and `commit` then asks for that link
// with `metadata: { audience: 'same' }`; decisions.md, 2026-10-25).
//
// A composer that already Konnects the source its own way (an album made
// for a Krew is the Krew's album) passes `sourceHandled`: the tile shows,
// can't be dropped, and `commit` leaves it to the composer.

export interface KonnectTarget {
  slug: string;
  id: string;
  title?: string | null;
  // What it is beside its title, when the server said ("gang").
  noun?: string | null;
  // A draft's mark on the one whose audience the record follows.
  same?: boolean;
}

export const konnectKey = (t: Pick<KonnectTarget, 'slug' | 'id'>) =>
  `${t.slug}/${t.id}`;

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
  // What a draft keeps: the ones the person added, never the source.
  saved: KonnectTarget[];
  // Each pending one's audience, by `konnectKey`, once looked up (null
  // when it couldn't be): whether this composer's record could follow it.
  audiences: Record<string, AttachmentAudienceLookup | null>;
  // The pending one whose audience the record will follow ("Same as"), set
  // by `useSameAs`; null otherwise.
  leader: KonnectTarget | null;
  // Konnect the record just made to each pending one; `follow` is the one
  // whose audience it follows, if any. Failures are alerted, then returned.
  commit: (
    createdSlug: string,
    createdId: string,
    follow?: Pick<KonnectTarget, 'slug' | 'id'> | null,
  ) => Promise<KonnectFailure[]>;
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

// What a draft keeps of the pending ones: all but the record the composer
// was opened from. That one comes from the URL each time, so a draft opened
// later without it doesn't carry it (or its Same as) along.
export const draftKonnections = (
  pending: KonnectTarget[],
  source: Pick<KonnectTarget, 'slug' | 'id'> | null,
): KonnectTarget[] =>
  source ? pending.filter((t) => !same(t, source)) : pending;

// What of a draft's Konnections can come back: none to its own korner, and
// not the source, which is already there.
export const restorableKonnections = (
  saved: KonnectTarget[] | null | undefined,
  korner: string,
  source: Pick<KonnectTarget, 'slug' | 'id'> | null,
): KonnectTarget[] =>
  (saved ?? []).filter(
    (t) => t.slug !== korner && !(source && same(t, source)),
  );

const messages = defineMessages({
  failed: {
    id: 'konnect.commit_failed',
    defaultMessage: 'Couldn’t Konnect {records}.',
  },
});

export const useKonnect = (
  korner: string,
  { sourceHandled = false }: UseKonnectOptions = {},
): KonnectControls => {
  const intl = useIntl();
  const names = useRecordName();
  const dispatch = useAppDispatch();
  const { search } = useLocation();
  const parsed = useMemo(() => parseKonnectParam(search), [search]);
  const sourceSlug = parsed?.slug;
  const sourceId = parsed?.id;
  const [sourceTitle, setSourceTitle] = useState<string | null>(null);
  const [sourceNoun, setSourceNoun] = useState<string | null>(null);

  const source = useMemo<KonnectTarget | null>(
    () =>
      sourceSlug && sourceId
        ? {
            slug: sourceSlug,
            id: sourceId,
            title: sourceTitle,
            noun: sourceNoun,
          }
        : null,
    [sourceSlug, sourceId, sourceTitle, sourceNoun],
  );

  // The source's title, for its tile: the URL carries only its id.
  useEffect(() => {
    setSourceTitle(null);
    setSourceNoun(null);
    if (!sourceSlug || !sourceId) return undefined;
    let cancelled = false;
    apiSearchAttachmentCandidates(sourceSlug, '', 1, false, sourceId)
      .then((rows) => {
        if (cancelled) return;
        setSourceTitle(rows[0]?.title ?? null);
        setSourceNoun(rows[0]?.noun ?? null);
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
      setAdded(restorableKonnections(saved, korner, sourceRef.current));
    },
    [korner],
  );

  const toCommit = useMemo(
    () => visible.filter((t) => !(sourceHandled && source && same(t, source))),
    [visible, sourceHandled, source],
  );
  const keep = useMemo(
    () => draftKonnections(toCommit, source),
    [toCommit, source],
  );

  // Each pending one's audience, as seen from a new record here.
  const [audiences, setAudiences] = useState<
    Record<string, AttachmentAudienceLookup | null>
  >({});
  const asked = useRef(new Set<string>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    visible.forEach((target) => {
      const key = konnectKey(target);
      if (asked.current.has(key)) return;
      asked.current.add(key);
      apiGetAttachmentAudience(target.slug, target.id, korner)
        .then((audience) => {
          if (mounted.current)
            setAudiences((prev) => ({ ...prev, [key]: audience }));
          return undefined;
        })
        .catch(() => {
          if (mounted.current)
            setAudiences((prev) => ({ ...prev, [key]: null }));
        });
    });
  }, [visible, korner]);

  const commit = useCallback(
    async (
      createdSlug: string,
      createdId: string,
      follow?: Pick<KonnectTarget, 'slug' | 'id'> | null,
    ) => {
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
                ...(follow && same(follow, target)
                  ? { metadata: { audience: 'same' } }
                  : {}),
              });
              return null;
            } catch (error) {
              return { target, error };
            }
          }),
      );
      const failures = results.flatMap((r) =>
        r.status === 'fulfilled' && r.value ? [r.value] : [],
      );
      // Said here, once, for every composer: the alert outlives the
      // composer closing and the page moving on to the new record.
      if (failures.length > 0)
        dispatch(
          showAlert({
            message: intl.formatMessage(messages.failed, {
              records: intl.formatList(
                failures.map((f) => names.the(f.target)),
                { type: 'conjunction' },
              ),
            }),
          }),
        );
      return failures;
    },
    [toCommit, dispatch, intl, names],
  );

  return {
    korner,
    source,
    pending: visible,
    removable,
    add,
    remove,
    restore,
    saved: keep,
    audiences,
    leader: null,
    commit,
  };
};
