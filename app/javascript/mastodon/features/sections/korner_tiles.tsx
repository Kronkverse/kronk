import type { ApiKornerJSON } from 'mastodon/api_types/korners';
import { Icon } from 'mastodon/components/icon';
import { SpaceCard, SpaceGrid } from 'mastodon/components/space_grid';
import { useKorners } from 'mastodon/hooks/useKorner';
import { kornerIcon } from 'mastodon/hooks/useKornerIcon';

// The korners a section names, in its order, from the loaded registry.
// A korner that isn't loaded (switched off, or not there yet) is left out.
export const useSectionKorners = (slugs: string[]): ApiKornerJSON[] => {
  const korners = useKorners();
  return slugs.flatMap((slug) => korners.filter((k) => k.slug === slug));
};

// A korner as a tile: its glyph and name, opening `to` (its space, or its
// composer on Share). The standard SpaceCard, so a section reads like any
// other collection on Kronk.
export const KornerCard: React.FC<{
  korner: ApiKornerJSON;
  to?: string;
  label?: string;
}> = ({ korner, to, label }) => (
  <SpaceCard
    to={to ?? `/hub/${korner.slug}`}
    placeholder={
      <Icon
        id={korner.icon?.material ?? korner.slug}
        icon={kornerIcon(korner.slug, korner)}
        className='section-page__glyph'
      />
    }
    title={label ?? korner.name}
    tag={
      !to && (korner.unread_count ?? 0) > 0
        ? `${korner.unread_count} new`
        : undefined
    }
  />
);

export const KornerTiles: React.FC<{
  korners: ApiKornerJSON[];
  layout?: 'grid' | 'row';
}> = ({ korners, layout = 'grid' }) => (
  <SpaceGrid layout={layout} className='section-page__tiles'>
    {korners.map((k) => (
      <KornerCard key={k.slug} korner={k} />
    ))}
  </SpaceGrid>
);

// A section's title and line under it. A section isn't a `/hub/<slug>`
// route, so the Frame's manifest-driven header doesn't draw one; this is
// the same `.space-header` with `data-frame-header`, as /me draws its own.
export const SectionHeader: React.FC<{
  title: string;
  tagline: string;
}> = ({ title, tagline }) => (
  <header className='space-header sections-header' data-frame-header=''>
    <h1 className='space-header__title'>{title}</h1>
    <p className='space-header__tagline'>{tagline}</p>
  </header>
);
