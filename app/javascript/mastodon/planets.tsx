// Transitional shim — reads display data from the manifest registry
// (fetchKorners populates it at app boot) instead of a hardcoded planet
// table. Kept in place so the ~13 consumer files keep compiling while
// their call sites migrate to `useKorner(slug)` directly.
//
// New code should use the hook, not these helpers.

import GavelIcon from '@/material-icons/400-24px/gavel.svg?react';
import QuestionMarkIcon from '@/material-icons/400-24px/question_mark.svg?react';
import CalendarIcon from '@/material-icons/400-24px/calendar_month.svg?react';
import HeadphonesIcon from '@/material-icons/400-24px/headphones.svg?react';
import InventoryIcon from '@/material-icons/400-24px/inventory_2.svg?react';
import DiversityIcon from '@/material-icons/400-24px/diversity_2.svg?react';
import HourglassIcon from '@/material-icons/400-24px/hourglass.svg?react';
import PhotoLibraryIcon from '@/material-icons/400-24px/photo_library.svg?react';
import ExploreIcon from '@/material-icons/400-24px/explore.svg?react';
import PartnerExchangeIcon from '@/material-icons/400-24px/partner_exchange.svg?react';

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

// Slug → icon component. Names match the manifest's `icon:` field where
// possible; when a manifest asks for an icon not shipped in the material
// assets we substitute a close visual match.
const SLUG_TO_ICON: Record<string, IconProp> = {
  kommons: GavelIcon,
  kuestions: QuestionMarkIcon,
  kalendar: CalendarIcon,
  huddle: PartnerExchangeIcon,
  booth: HeadphonesIcon,
  marketplace: InventoryIcon,
  'in-flow': DiversityIcon,
  nudges: PartnerExchangeIcon,
  moments: HourglassIcon,
  albutts: PhotoLibraryIcon,
  kompass: ExploreIcon,
};

const getSlug = (space: string): string =>
  SPACE_TO_SLUG[space] ?? space.toLowerCase();

const getManifest = (space: string): ApiKornerJSON | undefined => {
  const state = store.getState();
  const korners = state.get('korners') as Record<string, ApiKornerJSON> | undefined;
  return korners?.[getSlug(space)];
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

// Fallback for slugs we haven't mapped yet.
const AccentCircle: IconProp = (props) => (
  <svg viewBox='0 0 24 24' {...props}>
    <circle cx='12' cy='12' r='10' style={{ fill: 'var(--accent)' }} />
  </svg>
);

export function planetIcon(space: string): IconProp {
  return SLUG_TO_ICON[getSlug(space)] ?? AccentCircle;
}
