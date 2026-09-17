import classNames from 'classnames';

import WavingHandIcon from '@/material-icons/400-24px/waving_hand.svg?react';

// WavingHandBadge — the shared "something new here" alert mark. A small
// purple badge with the waving-hand glyph, overlaid on the surface it
// annotates (the Nudges nav icon, a Hub korner tile, a proposal card).
// Driven by the notification store via the selectors in
// selectors/notifications.ts; this component is presentation only.
interface Props {
  className?: string;
  // Accessible label; when omitted the badge is decorative (aria-hidden).
  label?: string;
}

export const WavingHandBadge: React.FC<Props> = ({ className, label }) => (
  <span
    className={classNames('waving-hand-badge', className)}
    role={label ? 'img' : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
    title={label}
  >
    <WavingHandIcon />
  </span>
);
