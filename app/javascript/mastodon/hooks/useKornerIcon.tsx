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

// Slug → icon component. Names match the manifest's `icon:` field
// where possible; when a manifest asks for an icon not shipped in the
// material assets we substitute a close visual match.
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

// Fallback when a slug has no mapped icon yet (tree / klot / newly-added
// korners). Renders a Kronk-purple circle.
export const AccentCircle: IconProp = (props) => (
  <svg viewBox='0 0 24 24' {...props}>
    <circle cx='12' cy='12' r='10' style={{ fill: 'var(--accent)' }} />
  </svg>
);

// Consumers pass the korner's slug (from a manifest); returns the
// SVG-as-React-component that ColumnHeader / StatusKornerCard accept
// via their `iconComponent` prop.
//
//   const icon = useKornerIcon('kommons');
//   <ColumnHeader iconComponent={icon} title='Kommons' />
export const useKornerIcon = (slug: string | undefined): IconProp => {
  if (!slug) return AccentCircle;
  return SLUG_TO_ICON[slug] ?? AccentCircle;
};
