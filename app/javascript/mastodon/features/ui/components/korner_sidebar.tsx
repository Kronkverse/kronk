import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { useAllKorners } from 'mastodon/hooks/useKorner';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';
import type { ApiKornerJSON } from 'mastodon/api_types/korners';

// Pervasive left rail — always present alongside the top strip and
// Ӂ bubble. Lists every enforced korner as an icon + name; most-
// active at the top. Matches Sanctum's guild rail vibe (280px, black,
// accent right-border).
//
// Ordering: tune_in_count desc as a "most recent activity" proxy;
// swap for a real last-activity timestamp once we index that.

const SLUG_RE = /^\/hub\/([a-z0-9-]+)(?:\/|$)/;

const KornerRow: React.FC<{ korner: ApiKornerJSON; active: boolean }> = ({ korner, active }) => {
  const Icon = useKornerIcon(korner.slug);
  return (
    <Link
      to={`/hub/${korner.slug}`}
      className={`korner-sidebar__row ${active ? 'korner-sidebar__row--active' : ''}`}
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

  const activeSlug = useMemo(() => {
    const m = SLUG_RE.exec(location.pathname);
    return m?.[1];
  }, [location.pathname]);

  const listed = useMemo(
    () =>
      korners
        .filter((k) => k.enforced !== false)
        .sort((a, b) => {
          const diff = (b.tune_in_count ?? 0) - (a.tune_in_count ?? 0);
          return diff !== 0 ? diff : a.name.localeCompare(b.name);
        }),
    [korners],
  );

  return (
    <aside className='korner-sidebar' aria-label='Korners'>
      <nav className='korner-sidebar__list'>
        {listed.map((k) => (
          <KornerRow key={k.slug} korner={k} active={activeSlug === k.slug} />
        ))}
      </nav>
      <Link to='/hub' className='korner-sidebar__all'>
        All korners →
      </Link>
    </aside>
  );
};
