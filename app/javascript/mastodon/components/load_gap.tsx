import { useEffect, useRef } from 'react';

// Invisible mid-stream gap sentinel. When a `TIMELINE_GAP` marker sits
// between two loaded batches (server returned an incomplete window),
// this fires the paginated `onClick(param)` fetch silently as the gap
// scrolls near the viewport. There's no button and no spinner — the
// user should never see a "load more" affordance for a data-continuity
// concern the client can resolve on its own. Matches the sibling
// LoadMoreSentinel pattern used at list-end (PR #993).
//
// Fires once per mount; if the fetch fails and the gap stays in the
// DOM, React re-mounts on the next list update and the observer
// re-engages.

interface Props<T> {
  disabled: boolean;
  param: T;
  onClick: (params: T) => void;
}

export const LoadGap = <T,>({ disabled, param, onClick }: Props<T>) => {
  const ref = useRef<HTMLDivElement>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;
    firedRef.current = false;

    const io = new IntersectionObserver(
      (entries) => {
        if (firedRef.current) return;
        if (entries.some((e) => e.isIntersecting)) {
          firedRef.current = true;
          onClick(param);
        }
      },
      { rootMargin: '400px 0px' },
    );
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, [disabled, param, onClick]);

  return <div ref={ref} className='load-gap-sentinel' aria-hidden='true' />;
};
