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
import type { IconProp } from 'mastodon/components/icon';
import { kornerIcon } from 'mastodon/hooks/useKornerIcon';

import type { MapNode } from '../../kommons_tree/data/layout';

// A node's icon:
//   * korner leaf → the korner mark from `kornerIcon(node.korner)`.
//   * limb (direct child of the core) → the limb's own manifest via
//     `kornerIcon(node.id)`; falls back to `AccentCircle` if the
//     manifest lookup misses (see `kornerIcon` in useKornerIcon.tsx).
//   * anything else → generic page mark.
// The core (Ж) is drawn by the component itself, not here.
export const latticeIcon = (node: MapNode, rootId: string): IconProp => {
  if (node.korner) return kornerIcon(node.korner);
  if (node.parent === rootId) return kornerIcon(node.id);
  return ArticleIcon;
};
