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
//
// The slice is read by property, not `state.get('korners')`. The root state
// is an Immutable Record, which exposes its keys both ways, so both work at
// runtime — but only property access is typed, and reaching for `.get` cost
// us the slice's type and forced a hand-written cast to get it back. The cast
// is what made this worth changing: it asserted a shape TypeScript could have
// derived, so a rename in the reducer would have gone unnoticed here.
export const useKorner = (
  slug: string | undefined,
): ApiKornerJSON | undefined => {
  return useAppSelector((state) => (slug ? state.korners[slug] : undefined));
};

// Convenience selectors used by chrome components (Hub grid, feed cards).
export const useKornerSlugs = (): string[] => {
  return useAppSelector((state) => Object.keys(state.korners));
};

export const useAllKorners = (): ApiKornerJSON[] => {
  return useAppSelector((state) => Object.values(state.korners));
};
