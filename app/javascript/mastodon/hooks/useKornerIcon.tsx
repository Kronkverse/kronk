import AccountCircleIcon from '@/material-icons/400-24px/account_circle.svg?react';
import AllInclusiveFillIcon from '@/material-icons/400-24px/all_inclusive-fill.svg?react';
import AllInclusiveIcon from '@/material-icons/400-24px/all_inclusive.svg?react';
import AustraliaIcon from '@/material-icons/400-24px/australia.svg?react';
import ChoiceIcon from '@/material-icons/400-24px/choice.svg?react';
import ConstructionFillIcon from '@/material-icons/400-24px/construction-fill.svg?react';
import ConstructionIcon from '@/material-icons/400-24px/construction.svg?react';
import CycleIcon from '@/material-icons/400-24px/cycle.svg?react';
import DiversityIcon from '@/material-icons/400-24px/diversity_2.svg?react';
import FmdBadIcon from '@/material-icons/400-24px/fmd_bad.svg?react';
import GlobeIcon from '@/material-icons/400-24px/globe.svg?react';
import GridOnFillIcon from '@/material-icons/400-24px/grid_on-fill.svg?react';
import GridOnIcon from '@/material-icons/400-24px/grid_on.svg?react';
import GroupsIcon from '@/material-icons/400-24px/groups.svg?react';
import GynecologyIcon from '@/material-icons/400-24px/gynecology.svg?react';
import HeadphonesIcon from '@/material-icons/400-24px/headphones.svg?react';
import HomeIcon from '@/material-icons/400-24px/home.svg?react';
import HourglassIcon from '@/material-icons/400-24px/hourglass.svg?react';
import HubFillIcon from '@/material-icons/400-24px/hub-fill.svg?react';
import HubIcon from '@/material-icons/400-24px/hub.svg?react';
import InFlowIcon from '@/material-icons/400-24px/in_flow.svg?react';
import KronkCoinIcon from '@/material-icons/400-24px/kronk_coin.svg?react';
import KuestionIcon from '@/material-icons/400-24px/kuestion.svg?react';
import NotListedLocationIcon from '@/material-icons/400-24px/not_listed_location.svg?react';
import PhotoLibraryFillIcon from '@/material-icons/400-24px/photo_library-fill.svg?react';
import PhotoLibraryIcon from '@/material-icons/400-24px/photo_library.svg?react';
import QuestionMarkIcon from '@/material-icons/400-24px/question_mark.svg?react';
import RavenIcon from '@/material-icons/400-24px/raven.svg?react';
import SettingsIcon from '@/material-icons/400-24px/settings.svg?react';
import SnowflakeIcon from '@/material-icons/400-24px/snowflake.svg?react';
import SpiralIcon from '@/material-icons/400-24px/spiral.svg?react';
import StacksIcon from '@/material-icons/400-24px/stacks.svg?react';
import TauntIcon from '@/material-icons/400-24px/taunt.svg?react';
import TravelExploreIcon from '@/material-icons/400-24px/travel_explore.svg?react';
import type { IconProp } from 'mastodon/components/icon';
import { useKorner } from 'mastodon/hooks/useKorner';
import { store } from 'mastodon/store';

// Material Symbols name → React component. Every value in a manifest's
// `icon.material` field must appear here. New korner? Import the SVG
// and add a row. This is the ONLY icon lookup for chrome / column
// headers / dropdowns — the Hub-tile line-art lives in KornerGlyph.
const MATERIAL_TO_ICON: Record<string, IconProp> = {
  account_circle: AccountCircleIcon,
  all_inclusive: AllInclusiveIcon,
  australia: AustraliaIcon,
  choice: ChoiceIcon,
  construction: ConstructionIcon,
  cycle: CycleIcon,
  diversity_2: DiversityIcon,
  fmd_bad: FmdBadIcon,
  globe: GlobeIcon,
  grid_on: GridOnIcon,
  groups: GroupsIcon,
  gynecology: GynecologyIcon,
  headphones: HeadphonesIcon,
  home: HomeIcon,
  hourglass: HourglassIcon,
  hub: HubIcon,
  in_flow: InFlowIcon,
  kronk_coin: KronkCoinIcon,
  kuestion: KuestionIcon,
  not_listed_location: NotListedLocationIcon,
  photo_library: PhotoLibraryIcon,
  question_mark: QuestionMarkIcon,
  raven: RavenIcon,
  settings: SettingsIcon,
  snowflake: SnowflakeIcon,
  spiral: SpiralIcon,
  stacks: StacksIcon,
  taunt: TauntIcon,
  travel_explore: TravelExploreIcon,
};

// Filled variants — a subset of MATERIAL_TO_ICON. Populated only for
// glyphs that HAVE a `-fill.svg` (Google Material Symbols mostly do;
// Kronk-custom glyphs — spiral, in_flow, raven, kronk_coin, choice —
// don't ship fills, and gracefully fall back to their outline). Used
// by the sidebar to switch selected korners to the filled variant
// (the Material Symbols `FILL` axis analog for a static-SVG codebase).
const MATERIAL_TO_ICON_FILLED: Record<string, IconProp> = {
  all_inclusive: AllInclusiveFillIcon,
  construction: ConstructionFillIcon,
  grid_on: GridOnFillIcon,
  hub: HubFillIcon,
  photo_library: PhotoLibraryFillIcon,
};

// Fallback when a slug has no mapped icon yet — renders a Kronk-purple
// circle so the layout doesn't collapse.
export const AccentCircle: IconProp = (props) => (
  <svg viewBox='0 0 24 24' {...props}>
    <circle cx='12' cy='12' r='10' style={{ fill: 'var(--accent)' }} />
  </svg>
);

// Resolve the Material component to render for a given slug by reading
// the manifest's `icon.material` and looking it up in
// MATERIAL_TO_ICON. Callable outside a component (`kornerIcon`) or as a
// hook (`useKornerIcon`); both go through the same resolver so a rename
// in the manifest surfaces uniformly.
//
// If the caller doesn't already have a manifest, kornerIcon reads one
// directly from the Redux store. This lets non-hook callers (e.g. the
// Kommons lattice's `latticeIcon`) stay pure without every caller
// having to grab the store first.
//
// The optional `filled` flag returns the filled variant when the glyph
// has one — used by the sidebar for selected korners. Falls back to
// the outline for glyphs that don't ship a fill (Kronk-custom icons).
//
//   const icon = useKornerIcon('kommons');
//   <ColumnHeader iconComponent={icon} title='Kommons' />
export const kornerIcon = (
  slug: string | undefined,
  manifest?: { icon?: { material?: string | null } | null },
  filled = false,
): IconProp => {
  if (!slug) return AccentCircle;
  const resolved = manifest ?? store.getState().korners[slug];
  const material = resolved?.icon?.material ?? undefined;
  if (!material) return AccentCircle;
  if (filled && MATERIAL_TO_ICON_FILLED[material]) {
    return MATERIAL_TO_ICON_FILLED[material];
  }
  if (MATERIAL_TO_ICON[material]) return MATERIAL_TO_ICON[material];
  return AccentCircle;
};

export const useKornerIcon = (
  slug: string | undefined,
  filled = false,
): IconProp => {
  const manifest = useKorner(slug);
  return kornerIcon(slug, manifest, filled);
};
