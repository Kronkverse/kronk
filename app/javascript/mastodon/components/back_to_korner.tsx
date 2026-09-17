import { Link } from 'react-router-dom';

import ArrowBackIcon from '@/material-icons/400-24px/arrow_back.svg?react';

import { Icon } from './icon';

// BackToKorner — the shared "← back to parent" chip that every
// korner detail page renders at the top-left of its reading
// column. Tal 2026-08-17 called for a site-wide back button: the
// first adopter (event_detail via KornerDetail#back) shipped in
// #1573; this primitive extracts the render so any surface can
// mount it directly (Krew, Booth set, Kommons proposal / space /
// node, Live room, etc.).
//
// Semantic back, not browser back: always pushes to `href`. Deep-
// linked arrivals (search, notification, external share) still
// land somewhere useful. The label is a short parent name
// ("All events", "All krews", "The Booth", "Kommons") — the icon
// carries the "back" semantic.
//
// `<KornerDetail>` uses this internally when its `back` prop is
// set; pages that don't (yet) mount inside `<KornerDetail>` can
// import + drop it in above their title.

interface Props {
  href: string;
  label: React.ReactNode;
  className?: string;
}

export const BackToKorner: React.FC<Props> = ({ href, label, className }) => (
  <Link
    to={href}
    className={`kronk-back-chip${className ? ` ${className}` : ''}`}
  >
    <Icon
      id='arrow-back'
      icon={ArrowBackIcon}
      className='kronk-back-chip__icon'
    />
    <span>{label}</span>
  </Link>
);
