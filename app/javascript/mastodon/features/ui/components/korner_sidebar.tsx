import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Link, useLocation } from 'react-router-dom';

import { markKornerSeen } from 'mastodon/actions/korners';
import type { ApiKornerJSON } from 'mastodon/api_types/korners';
import { useKorners, useKornerUnreadCount } from 'mastodon/hooks/useKorner';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';
import { useAppDispatch } from 'mastodon/store';

// Pervasive icon rail on the right. Most-recently-visited korner
// floats to the top; ties break on tune_in_count desc, then alpha.
// Reorders with a hand-rolled FLIP animation so rows slide to their
// new positions instead of jumping.

const SLUG_RE = /^\/hub\/([a-z0-9-]+)(?:\/|$)/;
const STORAGE_KEY = 'kronk:korner-recency';

type Recency = Record<string, number>;

const readRecency = (): Recency => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Recency;
  } catch {
    return {};
  }
};

const writeRecency = (r: Recency) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
  } catch {
    // best-effort
  }
};

interface KornerRowProps {
  korner: ApiKornerJSON;
  active: boolean;
  onVisit: (slug: string) => void;
  registerRef: (slug: string, el: HTMLAnchorElement | null) => void;
}

const KornerRow: React.FC<KornerRowProps> = ({
  korner,
  active,
  onVisit,
  registerRef,
}) => {
  // Selected row swaps the icon to its filled variant when one ships
  // for that glyph (Material Symbols FILL-axis analog for a static-SVG
  // codebase — see useKornerIcon.tsx). Falls back to the outline for
  // Kronk-custom glyphs that don't have a `-fill.svg` yet.
  const Icon = useKornerIcon(korner.slug, active);
  const unread = useKornerUnreadCount(korner.slug);
  const hasUnread = unread > 0;
  const handleClick = useCallback(() => {
    onVisit(korner.slug);
  }, [onVisit, korner.slug]);
  const handleRef = useCallback(
    (el: HTMLAnchorElement | null) => {
      registerRef(korner.slug, el);
    },
    [registerRef, korner.slug],
  );
  const className = [
    'korner-sidebar__row',
    active ? 'korner-sidebar__row--active' : '',
    hasUnread ? 'korner-sidebar__row--has-unread' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <Link
      to={`/hub/${korner.slug}`}
      className={className}
      onClick={handleClick}
      data-name={korner.name}
      aria-label={korner.name}
      title={korner.name}
      ref={handleRef}
    >
      <span className='korner-sidebar__glyph' aria-hidden='true'>
        <Icon />
      </span>
      <span className='korner-sidebar__label'>{korner.name}</span>
      {hasUnread && (
        <span className='korner-sidebar__badge' aria-label={`${unread} new`}>
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
};

export const KornerSidebar = () => {
  const location = useLocation();
  const korners = useKorners();
  const dispatch = useAppDispatch();
  const [recency, setRecency] = useState<Recency>(() => readRecency());

  // FLIP bookkeeping: last-seen top offset per slug.
  const positions = useRef<Map<string, number>>(new Map());
  const nodes = useRef<Map<string, HTMLAnchorElement>>(new Map());

  const activeSlug = useMemo(() => {
    const m = SLUG_RE.exec(location.pathname);
    return m?.[1];
  }, [location.pathname]);

  useEffect(() => {
    if (!activeSlug) return;
    setRecency((prev) => {
      const next = { ...prev, [activeSlug]: Date.now() };
      writeRecency(next);
      return next;
    });
  }, [activeSlug]);

  // Opening a korner (via any entry path — Hub tile, this sidebar, or a deep
  // link) marks its content seen, so the unread badge clears. This effect is
  // the one place every /hub/<slug> navigation funnels through.
  //
  // Moments is excluded: it's seen item-by-item (each ring dims as you view or
  // froth that Moment), so opening one Moment must not mark the whole korner
  // seen. Its badge clears as the individual Moments are seen instead.
  useEffect(() => {
    if (activeSlug && activeSlug !== 'moments')
      dispatch(markKornerSeen({ slug: activeSlug }));
  }, [activeSlug, dispatch]);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setRecency(readRecency());
    };
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('storage', handler);
    };
  }, []);

  const onVisit = useCallback((slug: string) => {
    setRecency((prev) => {
      const next = { ...prev, [slug]: Date.now() };
      writeRecency(next);
      return next;
    });
  }, []);

  const registerRef = useCallback(
    (slug: string, el: HTMLAnchorElement | null) => {
      if (el) nodes.current.set(slug, el);
      else nodes.current.delete(slug);
    },
    [],
  );

  const listed = useMemo(
    () =>
      korners
        // Hide korners the viewer has tuned out of — the sidebar is "your"
        // korners; tuned-out ones drop off it (still reachable from the Hub).
        .filter((k) => k.enforced !== false && k.tuned_in !== false)
        .sort((a, b) => {
          const ra = recency[a.slug] ?? 0;
          const rb = recency[b.slug] ?? 0;
          if (ra !== rb) return rb - ra;
          const cd = (b.tune_in_count ?? 0) - (a.tune_in_count ?? 0);
          if (cd !== 0) return cd;
          return a.name.localeCompare(b.name);
        }),
    [korners, recency],
  );

  // FLIP: after the DOM commits with the new order, snap each row back
  // to its previous position, then transition to (0,0) so it slides.
  useLayoutEffect(() => {
    listed.forEach((k) => {
      const el = nodes.current.get(k.slug);
      if (!el) return;
      const prev = positions.current.get(k.slug);
      const current = el.offsetTop;
      if (prev !== undefined && prev !== current) {
        const dy = prev - current;
        el.style.transform = `translateY(${dy}px)`;
        el.style.transition = 'none';
        // Force reflow so the transform sticks before we transition away.
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        el.offsetHeight;
        requestAnimationFrame(() => {
          el.style.transform = '';
          el.style.transition =
            'transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1), background 150ms ease-out, color 150ms ease-out';
        });
      }
      positions.current.set(k.slug, current);
    });
  }, [listed]);

  return (
    <aside className='korner-sidebar' aria-label='Korners'>
      <nav className='korner-sidebar__list'>
        {listed.map((k) => (
          <KornerRow
            key={k.slug}
            korner={k}
            active={activeSlug === k.slug}
            onVisit={onVisit}
            registerRef={registerRef}
          />
        ))}
      </nav>
    </aside>
  );
};
