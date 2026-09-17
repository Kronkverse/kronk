import type { ElementType, ReactNode, HTMLAttributes } from 'react';

import classNames from 'classnames';
import type { LinkProps } from 'react-router-dom';

// StandardCard — the primitive every Kronk card is built on. Owns the
// shared shell (padding, radius, border, background, hover) and — for
// the `portrait` variant — the sizing math that mathematically
// guarantees the card fits the viewport on any screen.
//
// Two variants:
//
//   flow      — height derives from content. Default. Use for tiles
//               in a grid, list rows, feed cards, anything where the
//               card grows with what's in it. Standard shell + no
//               sizing constraints.
//
//   portrait  — fixed 9:19.5 phone shape (Kronk's "identity artefact"
//               aesthetic, used by ProfileCard). The card is
//               guaranteed to never exceed available viewport height
//               via a single sizing trick:
//
//                 max-inline-size: min(
//                   var(--card-portrait-max-inline),
//                   calc(var(--card-portrait-max-block) * 9 / 19.5)
//                 );
//
//               By capping WIDTH at min(design-max, height * aspect),
//               the aspect-ratio derived block-size can never exceed
//               the height cap. The container just controls
//               `--card-portrait-max-block` (how much viewport-height
//               is available in this space's chrome), and the card
//               fits.
//
// Adding a new card that fits automatically: wrap it in
// `<StandardCard>`, set `--card-portrait-max-block` on a parent (or
// keep the default if it's a full-viewport surface), and the layout
// contract is handled.
//
// ── The six slots ────────────────────────────────────────────────────
//
// A card is media, badge, title, meta, body and actions — always those,
// in every korner and every arrangement. The slots are what let content
// from one space appear in another: a space builds against the card, a
// korner fills the slots, and neither needs to know about the other
// (docs/kronk_card_standard.md).
//
// Two rules the slots depend on:
//
//   1. A slot is optional but never re-purposed. A korner with no image
//      leaves <CardMedia> out; it does not put its title there because
//      the card looked empty.
//   2. The arrangement decides what is drawn, not the content. `grid`
//      hides body and actions in CSS rather than at each call site —
//      one place to change what an arrangement shows, and a korner
//      cannot accidentally disagree with it.

// The three arrangements (docs/kronk_card_standard.md). Same card, same
// slots, three ways of drawing them.
//
//   flow      the feed arrangement — height follows content
//   portrait  9:19.5, one at a time, media dominant
//   grid      the same card smaller, many at once
type Variant = 'flow' | 'portrait' | 'grid';

interface StandardCardProps extends HTMLAttributes<HTMLElement> {
  variant?: Variant;
  // A card is usually the tap target for the thing it describes, so
  // `as={Link}` with a `to` is the common case rather than an exception.
  to?: LinkProps['to'];
  // Which HTML tag renders the shell. Default `article` — the card is
  // usually a self-contained thing. `section` and `div` also common;
  // `li` when the card is a direct list child.
  as?: ElementType;
  children: ReactNode;
  className?: string;
}

// ── Slots ────────────────────────────────────────────────────────────
// Deliberately thin: a class name and children. The weight is in the
// stylesheet, where an arrangement can restyle every card at once.

interface SlotProps {
  children: ReactNode;
  className?: string;
}

export const CardBadge: React.FC<SlotProps> = ({ children, className }) => (
  <span className={classNames('standard-card__badge', className)}>
    {children}
  </span>
);

// The visual. An <img>, a map glimpse, an avatar — whatever the korner
// leads with. A slot rather than a `src` prop because half of Kronk's
// media is drawn rather than photographed.
export const CardMedia: React.FC<SlotProps> = ({ children, className }) => (
  <div className={classNames('standard-card__media', className)}>
    {children}
  </div>
);

export const CardTitle: React.FC<SlotProps> = ({ children, className }) => (
  <h3 className={classNames('standard-card__title', className)}>{children}</h3>
);

// A short run of facts — author, date, counts. One line.
export const CardMeta: React.FC<SlotProps> = ({ children, className }) => (
  <div className={classNames('standard-card__meta', className)}>{children}</div>
);

// Prose. Clamped by the arrangement, not by the korner.
export const CardBody: React.FC<SlotProps> = ({ children, className }) => (
  <div className={classNames('standard-card__body', className)}>{children}</div>
);

// What you can do without opening the thing.
export const CardActions: React.FC<SlotProps> = ({ children, className }) => (
  <div className={classNames('standard-card__actions', className)}>
    {children}
  </div>
);

export const StandardCard: React.FC<StandardCardProps> = ({
  variant = 'flow',
  as: Tag = 'article',
  className,
  children,
  ...rest
}) => (
  <Tag
    className={classNames(
      'standard-card',
      `standard-card--${variant}`,
      className,
    )}
    {...rest}
  >
    {children}
  </Tag>
);
