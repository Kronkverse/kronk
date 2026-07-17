import ArticleIcon from '@/material-icons/400-24px/article.svg?react';
import BarChartIcon from '@/material-icons/400-24px/bar_chart_4_bars.svg?react';
import CalendarIcon from '@/material-icons/400-24px/calendar_month.svg?react';
import ChatIcon from '@/material-icons/400-24px/chat.svg?react';
import DiversityIcon from '@/material-icons/400-24px/diversity_2.svg?react';
import ExploreIcon from '@/material-icons/400-24px/explore.svg?react';
import GavelIcon from '@/material-icons/400-24px/gavel.svg?react';
import GroupsIcon from '@/material-icons/400-24px/groups.svg?react';
import HeadphonesIcon from '@/material-icons/400-24px/headphones.svg?react';
import HourglassIcon from '@/material-icons/400-24px/hourglass.svg?react';
import InventoryIcon from '@/material-icons/400-24px/inventory_2.svg?react';
import PartnerExchangeIcon from '@/material-icons/400-24px/partner_exchange.svg?react';
import PhotoLibraryIcon from '@/material-icons/400-24px/photo_library.svg?react';
import QuestionMarkIcon from '@/material-icons/400-24px/question_mark.svg?react';
import StarIcon from '@/material-icons/400-24px/star.svg?react';
import type { IconProp } from 'mastodon/components/icon';

// Slug → icon component. Names match the manifest's `icon:` field
// where possible; when a manifest asks for an icon not shipped in the
// material assets we substitute a close visual match. Every enforced
// korner must map to a unique icon so the Hub grid stays legible at
// a glance.
const SLUG_TO_ICON: Record<string, IconProp> = {
  kommons: GavelIcon, // gavel — governance
  kuestions: QuestionMarkIcon, // ? — questions
  kalendar: CalendarIcon, // calendar — events
  huddle: PartnerExchangeIcon, // handshake — live sessions
  booth: HeadphonesIcon, // headphones — audio
  marketplace: InventoryIcon, // stack — listings
  'in-flow': DiversityIcon, // people bloom — social
  nudges: ChatIcon, // speech bubble — chats
  moments: HourglassIcon, // hourglass — ephemeral
  albutts: PhotoLibraryIcon, // photo stack — albums
  kompass: ExploreIcon, // compass — presence
  groups: GroupsIcon, // group silhouettes
  tree: BarChartIcon, // stacked bars — hierarchy (proxy for account_tree)
  klot: ArticleIcon, // journal page — private log (proxy for nights_stay)
  you: StarIcon, // four-point star — Your Own Universe (proxy for self_improvement)
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
