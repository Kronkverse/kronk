import type {
  ApiNudgeEventJSON,
  ApiNudgeStreamItem,
} from 'mastodon/api_types/nudges_conversations';

// Collapses runs of consecutive passive nudges into aggregate lines
// per docs/kronk_nudges.md §Open decisions (resolved 2026-07-22):
//
// - Mate: bare froths/boosts roll up into a periodic strip.
// - Krew: consecutive same-motion nudges collapse into one expandable
//   line, keyed on (verb, source_type, source_id).
//
// Interactive nudges (with a CTA) never aggregate — they are
// actionable and deserve their own line. Messages never aggregate.
// Milestone pins (verb starts with `milestone_`) never aggregate.

export interface AggregatedEvent {
  kind: 'aggregate';
  key: string;
  verb: string;
  source_korner_slug: string;
  source_type: string | null;
  source_id: string | null;
  cta_route: string | null;
  cta_label: string | null;
  members: (ApiNudgeEventJSON & { kind: 'event' })[]; // oldest→newest
  // Time-window of the aggregate for the timestamp label — the newest
  // member drives the "when" the strip is shown at.
  created_at: string;
  id: string; // synthetic id for React key stability
}

export type StreamRenderItem = ApiNudgeStreamItem | AggregatedEvent;

const MATE_AGGREGATE_WINDOW_MS = 60 * 60 * 1000; // 1h bucket per §a

const isAggregatable = (
  item: ApiNudgeStreamItem,
): item is Extract<ApiNudgeStreamItem, { kind: 'event' }> =>
  item.kind === 'event' &&
  item.interaction === 'passive' &&
  !item.verb.startsWith('milestone_');

// Bucket key for consecutive aggregation. In Mate the actor is always
// the same account (the other Mate) — bucket by verb + hour window.
// In Krew the actor varies — bucket by (verb, source_type, source_id)
// so different actors doing the same thing to the same source roll up.
const aggregateKey = (
  event: Extract<ApiNudgeStreamItem, { kind: 'event' }>,
  kind: 'mate' | 'krew',
): string => {
  if (kind === 'mate') {
    const bucket = Math.floor(
      new Date(event.created_at).getTime() / MATE_AGGREGATE_WINDOW_MS,
    );
    return `mate:${event.verb}:${bucket}`;
  }
  return `krew:${event.verb}:${event.source_type ?? ''}:${event.source_id ?? ''}`;
};

export const aggregateStream = (
  items: ApiNudgeStreamItem[],
  kind: 'mate' | 'krew',
): StreamRenderItem[] => {
  const out: StreamRenderItem[] = [];
  let runKey: string | null = null;
  let runMembers: (ApiNudgeEventJSON & { kind: 'event' })[] = [];

  const flush = () => {
    if (runMembers.length === 0) return;
    if (runMembers.length === 1) {
      const only = runMembers[0];
      if (only) out.push(only);
    } else {
      const head = runMembers[0];
      const tail = runMembers[runMembers.length - 1];
      if (head && tail) {
        out.push({
          kind: 'aggregate',
          key: runKey ?? '',
          verb: head.verb,
          source_korner_slug: head.source_korner_slug,
          source_type: head.source_type,
          source_id: head.source_id,
          cta_route: head.cta_route,
          cta_label: head.cta_label,
          members: [...runMembers],
          created_at: tail.created_at,
          id: `agg-${runKey ?? ''}-${tail.id}`,
        });
      }
    }
    runKey = null;
    runMembers = [];
  };

  for (const item of items) {
    if (!isAggregatable(item)) {
      flush();
      out.push(item);
      continue;
    }
    const key = aggregateKey(item, kind);
    if (key === runKey) {
      runMembers.push(item);
    } else {
      flush();
      runKey = key;
      runMembers = [item];
    }
  }
  flush();
  return out;
};
