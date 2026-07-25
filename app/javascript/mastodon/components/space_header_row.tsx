import { AutoSettingsBadge } from './auto_settings_badge';
import { AutoSpaceBadge } from './auto_space_badge';
import { AutoSpaceHeader } from './auto_space_header';
import { AutoSpaceViewPicker } from './auto_space_view_picker';

// SpaceHeaderRow — the in-content header block every /hub/<slug> korner
// renders at the top of Stage. Was previously three separate pieces:
// the SpaceHeader inside Stage's scroll flow, plus a pair of pills
// (badge + view picker) fixed to the viewport via KronkFrame.SpaceNav.
// The fixed positioning meant those pills stayed put as the rest of
// the page scrolled, which read as an unrelated overlay. Consolidating
// them here means the whole header row scrolls together — the title,
// the tagline, and the pills that bracket them.
//
// Layout: CSS grid `[badge auto] [header 1fr] [picker auto]`. Each
// child gates itself on route/manifest so an unmounted slot collapses.
// See docs/kronk_frame.md § SpaceNav.

export const SpaceHeaderRow: React.FC = () => (
  <div className='space-header-row'>
    <div className='space-header-row__left'>
      <AutoSpaceBadge />
      <AutoSettingsBadge />
    </div>
    <div className='space-header-row__center'>
      <AutoSpaceHeader />
    </div>
    <div className='space-header-row__right'>
      <AutoSpaceViewPicker />
    </div>
  </div>
);
