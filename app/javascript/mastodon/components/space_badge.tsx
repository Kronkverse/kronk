import { Link } from 'react-router-dom';

// SpaceBadge — the "you are in Kuestions, tap to go back" pill.
//
// Merges what used to be two separate affordances (KornerExit's
// "← Hub" + the space's own hero title) into one compact pill. Same
// spot on every Stage-based korner (top-left, floating). Tapping
// navigates to the outer page (typically `/hub`). The arrow signals
// the affordance; the name provides the "you are here" cue.
//
// Historically also rendered a decorative letterform between the
// arrow and the name (from each manifest's `icon.text_glyph`).
// Retired 2026-08-06 (Tal: "I never asked for them and i reckon
// they're superfluous") — the pill is now just `[← <name>]`.
// `.space-badge__glyph` CSS is kept for SettingsBadge, which still
// renders a real cog SVG in that slot.
//
// Spec: docs/kronk_frame.md § SpaceNav.
// Prototype: docs/kronk_frame_prototype_v11.html.

interface SpaceBadgeProps {
  name: string;
  backTo?: string;
}

export const SpaceBadge: React.FC<SpaceBadgeProps> = ({
  name,
  backTo = '/hub',
}) => (
  <Link
    to={backTo}
    className='space-badge'
    aria-label={`Back to ${backTo === '/hub' ? 'Hub' : 'previous page'} from ${name}`}
  >
    <svg
      className='space-badge__arrow'
      viewBox='0 0 16 16'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.8'
      aria-hidden='true'
    >
      <path
        d='M10 3.5 L5.5 8 L10 12.5'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
    <span className='space-badge__name'>{name}</span>
  </Link>
);
