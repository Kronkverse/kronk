// Lattice row icons — every node's glyph comes from the shared
// `kornerIcon` map, which reads each korner's manifest `icon.material`.
// One source of truth: the icon a node wears here is the same icon its
// korner wears on the top nav Membrane pillar, the column header, and
// the sidebar tile. Tal 2026-08-11 — "they should all draw from the
// same icons, the directory should use the same icons as the top nav
// bar".
//
// Previously this file kept a local `LIMB_ICON` map for the four
// core-space limbs (feed / profile / nudges / settings) which had
// drifted from the manifests (e.g. it said `partner_exchange` for
// nudges while nudges.yaml said `raven`). Dropped — limb ids are the
// korner slugs, so `kornerIcon(node.id)` covers them uniformly.

import ArticleIcon from '@/material-icons/400-24px/article.svg?react';
import InfoIcon from '@/material-icons/400-24px/info.svg?react';
import SearchIcon from '@/material-icons/400-24px/search.svg?react';
import type { IconProp } from 'mastodon/components/icon';
import { kornerIcon } from 'mastodon/hooks/useKornerIcon';

import type { MapNode } from '../../kommons_tree/data/layout';

// The two limbs that are not korners and so have no manifest to read an icon
// from: Kronk (the org space — about, values, governance) and Search. Without
// these they fall through `kornerIcon`'s manifest lookup to a plain accent
// circle, which is what they were drawing — two unlabelled dots next to
// Settings' gear (Tal 2026-09-09 screenshot).
//
// This is not the `LIMB_ICON` map that was dropped above. That one restated
// icons the manifests already owned and drifted from them. These two own
// nothing to drift from.
const NON_KORNER_LIMB_ICON: Record<string, IconProp> = {
  kronk: InfoIcon,
  search: SearchIcon,
};

// A node's icon:
//   * korner leaf → the korner mark from `kornerIcon(node.korner)`.
//   * limb (direct child of the core) → the limb's own manifest via
//     `kornerIcon(node.id)`; falls back to `AccentCircle` if the
//     manifest lookup misses (see `kornerIcon` in useKornerIcon.tsx).
//   * korner Hand (a korner with >1 finger — Kommons, Kommunity,
//     Moments) → same mark as a leaf, resolved from the `korner:<slug>`
//     id prefix the tree builder uses. Hands intentionally have no
//     `node.korner` (so clicking expands rather than navigating), so
//     this branch is what keeps them from falling through to the
//     generic page mark (Tal 2026-09-08 — "Kommunity and Kommons
//     aren't showing their logos").
//   * anything else → generic page mark.
// The core (Ж) is drawn by the component itself, not here.
export const latticeIcon = (node: MapNode, rootId: string): IconProp => {
  if (node.korner) return kornerIcon(node.korner);
  if (node.id.startsWith('korner:')) {
    return kornerIcon(node.id.slice('korner:'.length));
  }
  if (node.parent === rootId) {
    return NON_KORNER_LIMB_ICON[node.id] ?? kornerIcon(node.id);
  }
  return ArticleIcon;
};
