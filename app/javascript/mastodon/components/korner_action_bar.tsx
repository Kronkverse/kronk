import classNames from 'classnames';

// KornerActionBar — the row of pill buttons under a korner content
// title. Invite / Edit / Delete on event detail, Join / Leave on Krew,
// Vote on a Kommons proposal, Play on a Booth set. Every korner had
// been writing its own `.<korner>-page__actions` block with the same
// shape (flex row, small gap, wrap on overflow). This is the layout;
// `<KornerPill>` (below) is the button.

interface KornerActionBarProps {
  children: React.ReactNode;
  className?: string;
  // `end` = align actions to the trailing edge (icon-button rows next
  // to a title). Default `start` — actions read left-to-right under
  // the content. Bar always wraps on narrow phone widths so a long
  // row of actions breaks to two rows rather than side-scrolling.
  align?: 'start' | 'end' | 'center' | 'between';
}

export const KornerActionBar: React.FC<KornerActionBarProps> = ({
  children,
  className,
  align = 'start',
}) => (
  <div
    className={classNames(
      'korner-action-bar',
      `korner-action-bar--align-${align}`,
      className,
    )}
    role='group'
  >
    {children}
  </div>
);
