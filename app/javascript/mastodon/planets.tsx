// DEPRECATED — the planet metaphor is retired in Kronk 2.0.0.
//
// This module now shims its own former API so the ~13 consumer files
// keep compiling while they migrate to `useKorner(slug)` in a following
// phase. Every function returns a Kronk-purple accent, the passed-in
// space name, or a shared placeholder icon. Do not add new callers.
//
// See docs/kronk_korner_spec.md §6.

import type { IconProp } from 'mastodon/components/icon';

export function spaceColor(_space: string): string {
  return 'var(--accent)';
}

export function planetName(space: string): string {
  return space;
}

const AccentCircle = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox='0 0 24 24' {...props}>
    <circle cx='12' cy='12' r='10' style={{ fill: 'var(--accent)' }} />
  </svg>
);

export function planetIcon(_space: string): IconProp {
  return AccentCircle as unknown as IconProp;
}
