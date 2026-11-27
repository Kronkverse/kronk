import { useCallback } from 'react';

import { useIntl, defineMessages } from 'react-intl';

import { Link } from 'react-router-dom';

import type { FtdSectionRow } from 'mastodon/api_types/freethedream';

import { projectPath } from './shared';

// A projekt as a wheel (Tal, 2026-11-26): the projekt in the middle and
// its Komponents around it like spokes, each opening its page. A
// Komponent's page draws the same wheel for its elements, and tapping one
// scrolls down to its section. Each spoke's ring fills as its checklist is
// sorted; a dot says there's talk you haven't seen.

const messages = defineMessages({
  progress: {
    id: 'freethedream.wheel.progress',
    defaultMessage: '{title}, {done} of {of} sorted',
  },
});

// Where the spokes end, from the middle, as a share of the wheel's width.
const REACH = 38;

export interface Spoke extends FtdSectionRow {
  unseen?: number;
}

export const Wheel: React.FC<{
  title: string;
  spokes: Spoke[];
  // A spoke opens its page, or, given this, does this instead.
  onPick?: (spoke: Spoke) => void;
}> = ({ title, spokes, onPick }) => {
  const intl = useIntl();
  const n = spokes.length;
  // As large as fits without neighbours touching, between 16% and 24%.
  const size =
    n > 1
      ? Math.max(16, Math.min(24, 2 * REACH * Math.sin(Math.PI / n) - 3))
      : 24;
  const at = (i: number) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    return { x: 50 + REACH * Math.cos(angle), y: 50 + REACH * Math.sin(angle) };
  };

  return (
    <div className='freethedream-wheel'>
      <svg
        className='freethedream-wheel__spokes'
        viewBox='0 0 100 100'
        aria-hidden='true'
      >
        {spokes.map((spoke, i) => {
          const { x, y } = at(i);
          return <line key={spoke.id} x1={50} y1={50} x2={x} y2={y} />;
        })}
      </svg>
      <div className='freethedream-wheel__hub'>
        <span className='freethedream-wheel__label'>{title}</span>
      </div>
      <ul className='freethedream-wheel__rim'>
        {spokes.map((spoke, i) => {
          const { x, y } = at(i);
          const { sorted, total } = spoke.progress;
          const share = total > 0 ? Math.min(1, sorted / total) : 0;
          const style = {
            left: `${x}%`,
            top: `${y}%`,
            width: `${size}%`,
            '--sorted': `${share * 360}deg`,
          } as React.CSSProperties;
          const label =
            total > 0
              ? intl.formatMessage(messages.progress, {
                  title: spoke.title,
                  done: Math.min(sorted, total),
                  of: total,
                })
              : spoke.title;
          const inner = (
            <>
              <span className='freethedream-wheel__label'>{spoke.title}</span>
              {!!spoke.unseen && (
                <span className='freethedream-wheel__new' aria-hidden='true' />
              )}
            </>
          );
          const className = spoke.done
            ? 'freethedream-wheel__spoke freethedream-wheel__spoke--done'
            : 'freethedream-wheel__spoke';
          return (
            <li key={spoke.id} style={style}>
              {onPick ? (
                <SpokeButton
                  spoke={spoke}
                  onPick={onPick}
                  className={className}
                  label={label}
                >
                  {inner}
                </SpokeButton>
              ) : (
                <Link
                  to={projectPath(spoke)}
                  className={className}
                  aria-label={label}
                  title={label}
                >
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const SpokeButton: React.FC<{
  spoke: Spoke;
  onPick: (spoke: Spoke) => void;
  className: string;
  label: string;
  children: React.ReactNode;
}> = ({ spoke, onPick, className, label, children }) => {
  const handleClick = useCallback(() => {
    onPick(spoke);
  }, [spoke, onPick]);
  return (
    <button
      type='button'
      className={className}
      aria-label={label}
      title={label}
      onClick={handleClick}
    >
      {children}
    </button>
  );
};
