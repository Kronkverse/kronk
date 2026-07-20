// Lattice row icons — Material Symbols throughout (spec §6, decision "option b":
// one icon vocabulary across the app, no bespoke glyph set).
//
// Interim sourcing: korner marks come from the shared `kornerIcon` map; the
// core-space limbs use their manifest icon by name here. The dedicated
// names+icons-from-manifest consolidation will make the API serve each space's
// icon so this map disappears — but the Lattice already speaks Material Symbols,
// so that change is a rewire, not a rework.

import AccountIcon from '@/material-icons/400-24px/account_circle.svg?react';
import ArticleIcon from '@/material-icons/400-24px/article.svg?react';
import HomeIcon from '@/material-icons/400-24px/home.svg?react';
import PartnerIcon from '@/material-icons/400-24px/partner_exchange.svg?react';
import SettingsIcon from '@/material-icons/400-24px/settings.svg?react';
import type { IconProp } from 'mastodon/components/icon';
import { AccentCircle, kornerIcon } from 'mastodon/hooks/useKornerIcon';

import type { MapNode } from '../../kommons_skeleton/data/layout';

// Core-space limbs, keyed by bucket. Matches each manifest's `icon:` where an
// asset ships (Hub's `apps` isn't vendored yet — it falls back to the accent
// circle until the manifest-icon pass reconciles the asset set).
const LIMB_ICON: Record<string, IconProp> = {
  feed: HomeIcon,
  profile: AccountIcon,
  nudges: PartnerIcon,
  settings: SettingsIcon,
};

// A node's icon, by what it is: the korner mark for a korner, the limb's icon
// for a limb, a generic page mark otherwise. The core (Ӂ) is drawn by the
// component itself, not here.
export const latticeIcon = (node: MapNode, rootId: string): IconProp => {
  if (node.korner) return kornerIcon(node.korner);
  if (node.parent === rootId) return LIMB_ICON[node.id] ?? AccentCircle;
  return ArticleIcon;
};
