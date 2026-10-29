import { useCallback } from 'react';

import { openModal } from 'mastodon/actions/modal';
import { useAppDispatch } from 'mastodon/store';

import type { ProposalScope } from './kommons_composer';

// Open the proposal composer over the page you are on, without leaving it
// (Kommons "Proposer Composer", 2026-10-29). Every in-app way to start a
// proposal goes through here: the Ж menu, the Hub's Propose a Korner
// tile, korner settings, node and space pages, the page picker.
export const useOpenProposer = () => {
  const dispatch = useAppDispatch();
  return useCallback(
    (scope: ProposalScope = {}) => {
      const { space, node, kind } = scope;
      dispatch(
        openModal({ modalType: 'PROPOSER', modalProps: { space, node, kind } }),
      );
    },
    [dispatch],
  );
};
