import { useCallback, useEffect } from 'react';

import { defineMessages } from 'react-intl';

import { useHistory } from 'react-router-dom';

import { showAlert } from 'mastodon/actions/alerts';
import { useAppDispatch } from 'mastodon/store';

import type { ProposalScope } from './kommons_composer';
import { KommonsComposer } from './kommons_composer';

const messages = defineMessages({
  opened: {
    id: 'governance.proposal_opened',
    defaultMessage: 'Your proposal is open. Find it in Kommons.',
  },
});

// The proposal composer over whatever page you are on (Kommons "Proposer
// Composer", 2026-10-29). Opened through ModalRoot (`useOpenProposer`), so
// the URL stays put, the back button closes it, and cancelling leaves you
// exactly where you were. `<ComposeShell>` draws its own backdrop, so the
// modal root's is cleared while it is open.
//
// Once it is opened: from inside Kommons you land on the new proposal;
// from anywhere else you stay put and are told where to find it
// (2026-10-12, "Proposal submission return").
const ProposerModal: React.FC<
  ProposalScope & {
    onClose: () => void;
    onChangeBackgroundColor?: (color: string | null) => void;
  }
> = ({ space, node, kind, onClose, onChangeBackgroundColor }) => {
  const history = useHistory();
  const dispatch = useAppDispatch();

  useEffect(() => {
    onChangeBackgroundColor?.('transparent');
    return () => {
      onChangeBackgroundColor?.(null);
    };
  }, [onChangeBackgroundColor]);

  const handleCreated = useCallback(
    (proposalId: string) => {
      // Navigate before closing, so the modal root sees a new page and
      // doesn't step back over the entry it pushed for the overlay.
      if (history.location.pathname.startsWith('/hub/kommons')) {
        history.push(`/hub/kommons/p/${proposalId}`);
      } else {
        dispatch(showAlert({ message: messages.opened }));
      }
      onClose();
    },
    [dispatch, history, onClose],
  );

  return (
    <KommonsComposer
      scope={{ space, node, kind }}
      onCancel={onClose}
      onCreated={handleCreated}
    />
  );
};

// eslint-disable-next-line import/no-default-export
export default ProposerModal;
