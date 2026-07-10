// Transitional shim — reads display data from the manifest registry
// (fetchKorners populates it at app boot) instead of a hardcoded planet
// table. Kept in place so the ~13 consumer files keep compiling while
// their call sites migrate to `useKorner(slug)` directly.
//
// New code should use the hook, not these helpers.

import type { IconProp } from 'mastodon/components/icon';
import { store } from 'mastodon/store';
import type { ApiKornerJSON } from 'mastodon/api_types/korners';

// Space-name → slug map. Consumers pass the old space name (e.g., 'Kommons')
// so we translate to the manifest slug (e.g., 'kommons') here rather than
// touching every call site.
const SPACE_TO_SLUG: Record<string, string> = {
  Kommons: 'kommons',
  Questions: 'kuestions',
  Kalendar: 'kalendar',
  Booth: 'booth',
  Marketplace: 'marketplace',
  Market: 'marketplace',
  InFlow: 'in-flow',
  Nudges: 'nudges',
  Tree: 'tree',
  Klot: 'klot',
  Huddle: 'huddle',
};

const getManifest = (space: string): ApiKornerJSON | undefined => {
  const slug = SPACE_TO_SLUG[space] ?? space.toLowerCase();
  const state = store.getState();
  const korners = state.get('korners') as Record<string, ApiKornerJSON> | undefined;
  return korners?.[slug];
};

// Accent — always the shared Kronk-purple. Manifest `aesthetic.overrides`
// can override on a per-korner basis in the future; not read here yet.
export function spaceColor(_space: string): string {
  return 'var(--accent)';
}

// Display name from the manifest (falls back to the space string if the
// registry hasn't loaded).
export function planetName(space: string): string {
  return getManifest(space)?.name ?? space;
}

const AccentCircle = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox='0 0 24 24' {...props}>
    <circle cx='12' cy='12' r='10' style={{ fill: 'var(--accent)' }} />
  </svg>
);

export function planetIcon(_space: string): IconProp {
  return AccentCircle as unknown as IconProp;
}
