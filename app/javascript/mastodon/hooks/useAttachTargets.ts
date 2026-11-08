import { useMemo } from 'react';

import type { ApiKornerJSON } from 'mastodon/api_types/korners';
import { useAllKorners, useKorner } from 'mastodon/hooks/useKorner';

// The korners a record in `sourceSlug` can be attached to, and with which
// kind: each `attaches:` entry naming a korner, plus, for a wildcard link
// (`to: '*'`), every other korner whose `accepts:` takes a link from it,
// kept to the pairs the Konnect grid allows (either side's `konnect.to`
// names the other; decisions.md, 2026-11-08). Spawns are left out (only
// the framework makes them), and so are references (nothing makes one
// yet). Shared by the picker and the "Attached" block so both agree on
// what's offered (docs/korners/adding_a_korner.md, Korner attachments).

export interface AttachTarget {
  slug: string;
  kind: 'link';
}

// The rule itself, apart from the store, so it can be tested on its own.
// What `row` is on `target` in the Konnect grid, if anything.
export const gridMode = (
  row: Pick<ApiKornerJSON, 'konnect'> | undefined,
  target: string,
): 'space' | 'link' | undefined => row?.konnect?.to?.[target];

export const attachTargetsFor = (
  sourceSlug: string,
  sourceManifest: Pick<ApiKornerJSON, 'attaches' | 'konnect'> | undefined,
  allKorners: Pick<ApiKornerJSON, 'slug' | 'accepts' | 'konnect'>[],
): AttachTarget[] => {
  const entries = sourceManifest?.attaches ?? [];
  const slugs = new Set<string>();

  entries.forEach((entry) => {
    if (entry.to !== '*' && entry.kind === 'link') slugs.add(entry.to);
  });

  if (entries.some((entry) => entry.to === '*' && entry.kind === 'link')) {
    allKorners.forEach((korner) => {
      if (korner.slug === sourceSlug) return;
      const acceptsUs = (korner.accepts ?? []).some(
        (a) => a.kind === 'link' && (a.from === '*' || a.from === sourceSlug),
      );
      if (acceptsUs) slugs.add(korner.slug);
    });
  }

  const inGrid = (slug: string) =>
    gridMode(sourceManifest, slug) !== undefined ||
    gridMode(
      allKorners.find((korner) => korner.slug === slug),
      sourceSlug,
    ) !== undefined;

  return Array.from(slugs)
    .filter(inGrid)
    .map((slug) => ({ slug, kind: 'link' as const }));
};

export const useAttachTargets = (sourceSlug: string): AttachTarget[] => {
  const sourceManifest = useKorner(sourceSlug);
  const allKorners = useAllKorners();

  return useMemo(
    () => attachTargetsFor(sourceSlug, sourceManifest, allKorners),
    [sourceSlug, sourceManifest, allKorners],
  );
};
