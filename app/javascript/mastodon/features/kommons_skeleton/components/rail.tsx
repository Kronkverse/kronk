import { useCallback, useEffect, useMemo, useRef } from 'react';

import { FormattedMessage } from 'react-intl';

import type { Bucket, KommonsNode, Lifecycle } from '../data/nodes';
import { bucketNodes, listKorners } from '../data/nodes';

// The Skeleton, walked sideways.
//
// Three bands exist at once: where you came from (dimmed, behind), where you
// are, and where you can go. The rail scrolls horizontally rather than
// repainting — a column is built once and kept, so the branch you walked stays
// physically present behind you rather than being implied by a breadcrumb.
//
// Movement is native horizontal scroll with snap points, not a transform. That
// buys touch momentum, rubber-banding, trackpad gestures and keyboard scrolling
// for free, and means a swipe forward or back is the same gesture as any other
// scroll on the device. Selecting a card scrolls the new band into view; the
// active depth is read back *from* scroll position, so swiping and tapping stay
// in agreement.

export type TrailStep =
  | { kind: 'root' }
  | { kind: 'bucket'; bucket: Bucket }
  | { kind: 'korner'; bucket: 'hub'; slug: string; label: string };

interface Card {
  id: string;
  label: string;
  sub?: string;
  lifecycle?: Lifecycle;
  count: number;
  leaf: boolean;
}

const BUCKETS: { id: Bucket; label: string; blurb: string }[] = [
  { id: 'feed', label: 'Feed', blurb: 'Timelines and activity' },
  { id: 'profile', label: 'Profile', blurb: 'You, and how you appear' },
  { id: 'hub', label: 'Hub', blurb: 'Every korner' },
];

const cardsFor = (step: TrailStep, nodes: KommonsNode[]): Card[] => {
  if (step.kind === 'root') {
    return BUCKETS.map((b) => ({
      id: b.id,
      label: b.label,
      sub: b.blurb,
      count: nodes
        .filter((n) => n.bucket === b.id)
        .reduce((a, n) => a + n.openProposals, 0),
      leaf: false,
    }));
  }

  if (step.kind === 'bucket' && step.bucket === 'hub') {
    const korners = listKorners(nodes).map((k) => ({
      id: `korner:${k.slug}`,
      label: k.label,
      sub: `${k.nodeCount} page${k.nodeCount === 1 ? '' : 's'}`,
      count: k.openProposals,
      leaf: false,
    }));
    const direct = nodes
      .filter((n) => n.bucket === 'hub' && !n.parent)
      .map((n) => ({
        id: n.id,
        label: n.label,
        sub: n.url,
        lifecycle: n.lifecycle,
        count: n.openProposals,
        leaf: true,
      }));
    return [...korners, ...direct];
  }

  const list =
    step.kind === 'korner'
      ? bucketNodes(nodes, 'hub', step.slug)
      : bucketNodes(nodes, step.bucket);

  return list.map((n) => ({
    id: n.id,
    label: n.label,
    sub: n.url,
    lifecycle: n.lifecycle,
    count: n.openProposals,
    leaf: true,
  }));
};

const headingFor = (step: TrailStep): string => {
  if (step.kind === 'root') return 'Kronk';
  if (step.kind === 'korner') return step.label;
  return BUCKETS.find((b) => b.id === step.bucket)?.label ?? step.bucket;
};

export const Rail: React.FC<{
  nodes: KommonsNode[];
  trail: TrailStep[];
  activeDepth: number;
  selectedAt: (depth: number) => string | undefined;
  onSelect: (depth: number, cardId: string) => void;
  onActiveDepth: (depth: number) => void;
}> = ({ nodes, trail, activeDepth, selectedAt, onSelect, onActiveDepth }) => {
  const railRef = useRef<HTMLDivElement | null>(null);
  const columnRefs = useRef<(HTMLDivElement | null)[]>([]);

  const columns = useMemo(
    () => trail.map((step) => ({ step, cards: cardsFor(step, nodes) })),
    [trail, nodes],
  );

  // Bring the newest band into view when the trail grows.
  useEffect(() => {
    const el = columnRefs.current[activeDepth];
    if (!el) return;
    el.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [activeDepth, columns.length]);

  // Read the active depth back from scroll, so a swipe moves you as surely as
  // a tap does. Whichever column is nearest the centre line wins.
  const handleScroll = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const centre = rail.scrollLeft + rail.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    columnRefs.current.forEach((el, i) => {
      if (!el) return;
      const mid = el.offsetLeft + el.offsetWidth / 2;
      const d = Math.abs(mid - centre);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    if (best !== activeDepth) onActiveDepth(best);
  }, [activeDepth, onActiveDepth]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(handleScroll);
    };
    rail.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      rail.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [handleScroll]);

  return (
    <div className='skeleton-rail' ref={railRef}>
      {columns.map(({ step, cards }, depth) => {
        const state =
          depth === activeDepth
            ? 'current'
            : depth === activeDepth - 1
              ? 'past'
              : depth < activeDepth
                ? 'behind'
                : 'next';
        const chosen = selectedAt(depth);

        return (
          <div
            key={`${depth}-${headingFor(step)}`}
            className='skeleton-band'
            data-state={state}
            ref={(el) => {
              columnRefs.current[depth] = el;
            }}
          >
            <div className='skeleton-band__head'>
              <span className='skeleton-band__depth'>{depth}</span>
              {headingFor(step)}
            </div>

            <div className='skeleton-band__cards'>
              {cards.map((card, i) => (
                <button
                  key={card.id}
                  type='button'
                  className='skeleton-card'
                  data-leaf={card.leaf}
                  data-chosen={card.id === chosen}
                  style={{ '--i': i } as React.CSSProperties}
                  onClick={() => {
                    onSelect(depth, card.id);
                  }}
                >
                  <span className='skeleton-card__name'>{card.label}</span>
                  {card.sub && (
                    <span className='skeleton-card__sub'>{card.sub}</span>
                  )}
                  {card.lifecycle && card.lifecycle !== 'live' ? (
                    <span
                      className={`skeleton-card__flag skeleton-card__flag--${card.lifecycle}`}
                    >
                      {card.lifecycle}
                    </span>
                  ) : (
                    <span
                      className='skeleton-card__tally'
                      data-zero={card.count === 0}
                    >
                      {card.count === 0 ? '—' : card.count}
                    </span>
                  )}
                </button>
              ))}

              {cards.length === 0 && (
                <p className='skeleton-band__empty'>
                  <FormattedMessage
                    id='kommons_skeleton.band.empty'
                    defaultMessage='Nothing here yet.'
                  />
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
