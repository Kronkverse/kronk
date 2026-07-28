import AccountCircleIcon from '@/material-icons/400-24px/account_circle.svg?react';
import AllInclusiveIcon from '@/material-icons/400-24px/all_inclusive.svg?react';
import ConstructionIcon from '@/material-icons/400-24px/construction.svg?react';
import CycleIcon from '@/material-icons/400-24px/cycle.svg?react';
import DiversityIcon from '@/material-icons/400-24px/diversity_2.svg?react';
import GlobeIcon from '@/material-icons/400-24px/globe.svg?react';
import GroupsIcon from '@/material-icons/400-24px/groups.svg?react';
import GynecologyIcon from '@/material-icons/400-24px/gynecology.svg?react';
import HeadphonesIcon from '@/material-icons/400-24px/headphones.svg?react';
import HomeIcon from '@/material-icons/400-24px/home.svg?react';
import HourglassIcon from '@/material-icons/400-24px/hourglass.svg?react';
import HubIcon from '@/material-icons/400-24px/hub.svg?react';
import KronkCoinIcon from '@/material-icons/400-24px/kronk_coin.svg?react';
import PhotoLibraryIcon from '@/material-icons/400-24px/photo_library.svg?react';
import QuestionMarkIcon from '@/material-icons/400-24px/question_mark.svg?react';
import RavenIcon from '@/material-icons/400-24px/raven.svg?react';
import SettingsIcon from '@/material-icons/400-24px/settings.svg?react';
import SnowflakeIcon from '@/material-icons/400-24px/snowflake.svg?react';
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
  construction: ConstructionIcon,
  cycle: CycleIcon,
  diversity_2: DiversityIcon,
  globe: GlobeIcon,
  groups: GroupsIcon,
  gynecology: GynecologyIcon,
  headphones: HeadphonesIcon,
  home: HomeIcon,
  hourglass: HourglassIcon,
  hub: HubIcon,
  kronk_coin: KronkCoinIcon,
  photo_library: PhotoLibraryIcon,
  question_mark: QuestionMarkIcon,
  raven: RavenIcon,
  settings: SettingsIcon,
  snowflake: SnowflakeIcon,
  taunt: TauntIcon,
  travel_explore: TravelExploreIcon,
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
//   const icon = useKornerIcon('kommons');
//   <ColumnHeader iconComponent={icon} title='Kommons' />
export const kornerIcon = (
  slug: string | undefined,
  manifest?: { icon?: { material?: string | null } | null },
): IconProp => {
  if (!slug) return AccentCircle;
  const resolved = manifest ?? store.getState().korners[slug];
  const material = resolved?.icon?.material ?? undefined;
  if (material && MATERIAL_TO_ICON[material]) return MATERIAL_TO_ICON[material];
  return AccentCircle;
};

export const useKornerIcon = (slug: string | undefined): IconProp => {
  const manifest = useKorner(slug);
  return kornerIcon(slug, manifest);
};
