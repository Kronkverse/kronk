import type { ElementType, ReactNode, HTMLAttributes } from 'react';

import classNames from 'classnames';

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

type Variant = 'flow' | 'portrait';

interface StandardCardProps extends HTMLAttributes<HTMLElement> {
  variant?: Variant;
  // Which HTML tag renders the shell. Default `article` — the card is
  // usually a self-contained thing. `section` and `div` also common;
  // `li` when the card is a direct list child.
  as?: ElementType;
  children: ReactNode;
  className?: string;
}

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
