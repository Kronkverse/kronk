import type { ApiKornerJSON } from 'mastodon/api_types/korners';
import { useAppSelector } from 'mastodon/store';

// Returns the manifest for a korner slug, or undefined if the registry
// hasn't loaded yet / the slug isn't registered.
//
//   const kommons = useKorner('kommons');
//   kommons?.icon   // → 'gavel'
//   kommons?.name   // → 'Kommons'
//
// The manifest is fetched once at app boot (see fetchKorners in
// features/ui/index.jsx). Consumers can render a fallback while it's
// loading — most korner pages don't unmount if the manifest resolves
// slightly later.
export const useKorner = (
  slug: string | undefined,
): ApiKornerJSON | undefined => {
  return useAppSelector((state) => {
    if (!slug) return undefined;
    // rootReducer combines via redux-immutable so we get() the slice
    // and then index by slug on the plain-object korners state.
    const korners = state.get('korners') as
      | Record<string, ApiKornerJSON>
      | undefined;
    return korners?.[slug];
  });
};

// Convenience selectors used by chrome components (Hub grid, feed cards).
export const useKornerSlugs = (): string[] => {
  return useAppSelector((state) => {
    const korners = state.get('korners') as
      | Record<string, ApiKornerJSON>
      | undefined;
    return korners ? Object.keys(korners) : [];
  });
};

export const useAllKorners = (): ApiKornerJSON[] => {
  return useAppSelector((state) => {
    const korners = state.get('korners') as
      | Record<string, ApiKornerJSON>
      | undefined;
    return korners ? Object.values(korners) : [];
  });
};
