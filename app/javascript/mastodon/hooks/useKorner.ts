import type { ApiKornerJSON } from 'mastodon/api_types/korners';
import { useAppSelector } from 'mastodon/store';

// Returns the manifest for a korner slug, or undefined if the registry
// hasn't loaded yet / the slug isn't registered.
//
//   const kommons = useKorner('kommons');
//   kommons?.icon              // → { material: 'construction', text_glyph: '✦' }
//   kommons?.icon?.material    // → 'construction'
//   kommons?.name              // → 'Kommons'
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

// Unread badge count for one korner — the number of new, feed-visible items
// the viewer hasn't seen. 0 when caught up, for anonymous viewers, or before
// the registry loads. See lib/kronk/korner_seen.rb.
export const useKornerUnreadCount = (slug: string | undefined): number => {
  return useAppSelector((state) =>
    slug ? (state.korners[slug]?.unread_count ?? 0) : 0,
  );
};

// Every registered manifest, including core spaces (feed / profile /
// hub / nudges / settings). Use this only when you specifically need
// core spaces — settings surfaces that let a user configure them,
// icon/name resolution for the top nav, etc. For the Hub grid,
// KornerSidebar, and anywhere else that means "the korner spaces a
// user opts into", use `useKorners()` instead.
export const useAllKorners = (): ApiKornerJSON[] => {
  return useAppSelector((state) => Object.values(state.korners));
};

// The korner spaces — non-core manifests only. This is the semantic
// definition of "a korner": a Hub-mounted, tune-in-able space (Klot,
// Kommons, Krew, Kuestions, …). Core spaces (feed, hub, nudges,
// profile, settings) are structurally different — they carry manifests
// so the top nav can resolve their icons and names, but they don't
// belong on the Hub grid or the KornerSidebar. Filtering here keeps
// consumers from repeating the `core !== true` check ad hoc (which
// the KornerSidebar was missing before this landed).
export const useKorners = (): ApiKornerJSON[] => {
  return useAppSelector((state) =>
    Object.values(state.korners).filter((k) => k.core !== true),
  );
};
