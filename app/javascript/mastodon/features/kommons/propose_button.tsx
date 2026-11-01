import { useCallback } from 'react';

import { useOpenProposer } from './use_open_proposer';

// "Propose a change to <space>" on a space's settings page: opens the
// proposal composer over the page, scoped to the space, so cancelling
// leaves you in settings (Kommons "Proposer Composer", 2026-10-29).
export const ProposeButton: React.FC<{
  space: string;
  children: React.ReactNode;
}> = ({ space, children }) => {
  const openProposer = useOpenProposer();
  const handleClick = useCallback(() => {
    openProposer({ space });
  }, [openProposer, space]);

  return (
    <button
      type='button'
      className='korner-settings__propose-cta'
      onClick={handleClick}
    >
      {children}
    </button>
  );
};
