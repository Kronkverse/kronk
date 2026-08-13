import classNames from 'classnames';

import type { IconProp } from './icon';
import { Icon } from './icon';

// KornerDetail — the shell every korner's detail page mounts inside.
// Provides the outer structure (hero image, standard title
// typography, meta line slot, actions bar slot, body slot) so
// event_detail, krew_detail, album_detail, proposal_page, space_page,
// booth_set_page stop each rebuilding this scaffolding.
//
// Deliberately thin — the shell owns the outer skeleton, the body
// owns everything inside. If your korner needs custom sections
// (attendees, member requirements, proposal comments), those live
// inside the body slot as children. The shell only prescribes:
// mount onto the `.stage-column` archetype (centred reading column,
// vertical scroll only), a hero above the title, a title with
// optional glyph, a subtitle under, a meta line and actions row
// under that. Body starts underneath.

interface KornerDetailProps {
  title: React.ReactNode;
  // Optional glyph rendered inline before the title text — same slot
  // EventCard / EventDetail use for the type indicator (calendar_month
  // for in-person, videocam for huddle).
  titleIcon?: IconProp;
  titleIconId?: string;
  subtitle?: React.ReactNode;
  hero?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  // Banner strip rendered above the title (LIVE NOW pip, etc.).
  banner?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export const KornerDetail: React.FC<KornerDetailProps> = ({
  title,
  titleIcon,
  titleIconId,
  subtitle,
  hero,
  meta,
  actions,
  banner,
  children,
  className,
}) => (
  <div className='stage-column'>
    <div className={classNames('korner-detail', className)}>
      {hero && <div className='korner-detail__hero'>{hero}</div>}
      {banner && <div className='korner-detail__banner'>{banner}</div>}
      <h1 className='korner-detail__title'>
        {titleIcon && titleIconId && (
          <Icon
            id={titleIconId}
            icon={titleIcon}
            className='korner-detail__title-icon'
          />
        )}
        <span className='korner-detail__title-text'>{title}</span>
      </h1>
      {subtitle && <p className='korner-detail__subtitle'>{subtitle}</p>}
      {meta && <div className='korner-detail__meta'>{meta}</div>}
      {actions && <div className='korner-detail__actions'>{actions}</div>}
      {children && <div className='korner-detail__body'>{children}</div>}
    </div>
  </div>
);
