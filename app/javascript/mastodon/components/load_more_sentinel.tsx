import { useEffect, useRef } from 'react';

// Invisible bottom-of-list sentinel that fires `onLoadMore` when it
// scrolls near the viewport. Replaces the classic <LoadMore> button
// inside ScrollableList — infinite scroll should be silent, not a
// button the user has to click. Belt-and-suspenders with
// ScrollableList's existing `handleScroll` proximity trigger (fires
// within 400px of the bottom edge): if the scroll math misses
// (nested scroll container, small viewport, fullscreen), this
// sentinel picks it up.
//
// Fires once per mount; if the fetch fails and the sentinel stays in
// the DOM, unmount/remount cycles through re-observation on the next
// list update. Same pattern as LoadGap's auto-trigger — see
// `load_gap.tsx`.

interface Props {
  disabled?: boolean;
  onLoadMore: () => void;
}

export const LoadMoreSentinel: React.FC<Props> = ({
  disabled = false,
  onLoadMore,
}) => {
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
          onLoadMore();
        }
      },
      { rootMargin: '400px 0px' },
    );
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, [disabled, onLoadMore]);

  return <div ref={ref} className='load-more-sentinel' aria-hidden='true' />;
};
