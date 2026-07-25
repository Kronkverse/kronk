import { Link } from 'react-router-dom';

import { KornerName } from './korner_name';

// SpaceBadge — the "you are in Kuestions, tap to go back" pill.
//
// Merges what used to be two separate affordances (KornerExit's
// "← Hub" + the space's own hero title) into one compact pill. Same
// spot on every Stage-based korner (top-left, floating). Tapping
// navigates to the outer page (typically `/hub`). The arrow signals
// the affordance; the glyph + name provide the "you are here" cue.
//
// Spec: docs/kronk_frame.md § SpaceNav.
// Prototype: docs/kronk_frame_prototype_v11.html.

interface SpaceBadgeProps {
  glyph: string;
  name: string;
  backTo?: string;
}

export const SpaceBadge: React.FC<SpaceBadgeProps> = ({
  glyph,
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
    <span className='space-badge__glyph'>{glyph}</span>
    <span className='space-badge__name'>
      <KornerName name={name} />
    </span>
  </Link>
);
