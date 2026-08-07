import { Link } from 'react-router-dom';

import type { IconProp } from 'mastodon/components/icon';
import { Icon } from 'mastodon/components/icon';

// ComposeFab — the single floating action bubble that opens a
// korner's composer. Every korner surface that supports posting
// gets exactly one of these, in a consistent position (bottom-right
// of the Stage). Replaces the ad-hoc "+" buttons scattered across
// space headers / sidebars / card corners with one shape site-wide
// (Tal 2026-08-07: "compose button contained to the floating
// bubble").
//
// Routes to a `/hub/<slug>/composer` URL — the ComposeShell mounted
// at that route takes over from there. Rendering as an <a> (via
// Link) means keyboard / middle-click / open-in-new-tab all work
// natively, and the route history entry is what closes the
// composer if the user hits back.

interface ComposeFabProps {
  to: string;
  label: string;
  icon: IconProp;
  iconId?: string;
  className?: string;
}

export const ComposeFab: React.FC<ComposeFabProps> = ({
  to,
  label,
  icon,
  iconId = 'compose',
  className,
}) => {
  const rootClass = ['compose-fab', className ?? ''].filter(Boolean).join(' ');
  return (
    <Link to={to} className={rootClass} aria-label={label} title={label}>
      <span className='compose-fab__glyph' aria-hidden='true'>
        <Icon id={iconId} icon={icon} />
      </span>
    </Link>
  );
};
