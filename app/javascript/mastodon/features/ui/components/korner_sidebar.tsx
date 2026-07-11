import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { useAllKorners } from 'mastodon/hooks/useKorner';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';
import type { ApiKornerJSON } from 'mastodon/api_types/korners';

// Pervasive icon rail on the right. Most-recently-visited korner
// floats to the top; ties break on tune_in_count desc, then alpha.
//
// Recency lives in localStorage as {slug: iso-timestamp}. Updated on
// route match and on click. Syncs across tabs via a storage event.

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
    // Silent — recency is best-effort.
  }
};

const KornerRow: React.FC<{
  korner: ApiKornerJSON;
  active: boolean;
  onVisit: (slug: string) => void;
}> = ({ korner, active, onVisit }) => {
  const Icon = useKornerIcon(korner.slug);
  return (
    <Link
      to={`/hub/${korner.slug}`}
      className={`korner-sidebar__row ${active ? 'korner-sidebar__row--active' : ''}`}
      onClick={() => onVisit(korner.slug)}
      data-name={korner.name}
      aria-label={korner.name}
      title={korner.name}
    >
      <span className='korner-sidebar__glyph' aria-hidden='true'>
        <Icon />
      </span>
      <span className='korner-sidebar__label'>{korner.name}</span>
    </Link>
  );
};

export const KornerSidebar = () => {
  const location = useLocation();
  const korners = useAllKorners();
  const [recency, setRecency] = useState<Recency>(() => readRecency());

  const activeSlug = useMemo(() => {
    const m = SLUG_RE.exec(location.pathname);
    return m?.[1];
  }, [location.pathname]);

  // Whenever the active slug changes (route match), stamp its recency
  // and re-sort. Covers deep links / back-forward as well as clicks.
  useEffect(() => {
    if (!activeSlug) return;
    setRecency((prev) => {
      const next = { ...prev, [activeSlug]: Date.now() };
      writeRecency(next);
      return next;
    });
  }, [activeSlug]);

  // Cross-tab sync: when another tab writes recency, refresh ours.
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

  const listed = useMemo(
    () =>
      korners
        .filter((k) => k.enforced !== false)
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

  return (
    <aside className='korner-sidebar' aria-label='Korners'>
      <nav className='korner-sidebar__list'>
        {listed.map((k) => (
          <KornerRow key={k.slug} korner={k} active={activeSlug === k.slug} onVisit={onVisit} />
        ))}
      </nav>
      <Link to='/hub' className='korner-sidebar__all' title='All korners' data-name='All korners'>
        ⋯
      </Link>
    </aside>
  );
};
