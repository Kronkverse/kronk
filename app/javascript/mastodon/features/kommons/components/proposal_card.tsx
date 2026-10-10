import { useCallback } from 'react';

import { FormattedMessage } from 'react-intl';

import classNames from 'classnames';

import { WavingHandBadge } from 'mastodon/components/waving_hand_badge';
import { useKorner } from 'mastodon/hooks/useKorner';
import { selectUnreadProposalIds } from 'mastodon/selectors/notifications';
import { useAppSelector } from 'mastodon/store';

import type { Proposal } from '../types';

// One proposal as a row in a list — the Kommons board, a node page, a Space
// page.
//
// A list, not a stack of cards (Tal 2026-10-10: the board was hard to
// understand; "these all look more like a list rather than individual
// proposal cards, which I think is better"). Three lines, in reading order:
//
//   Create Huddle Room                                    ₭10
//   Creating a huddle doesn't work
//   Huddle · @tal · claimed by @pargo
//
// The summary is on the row because titles are often terse ("Kommunity")
// and the summary is what says what's being asked. No avatar, no korner
// chip, no ₭0 — ₭ appears only when something is backed, and status only
// when it isn't open. Left the card standard (StandardCard) for this: a
// row in a list isn't a feed or grid card.

const STATUS_LABELS: Record<Proposal['status'], string> = {
  open: 'Open',
  claimed: 'Claimed',
  actioned: 'Actioned',
  closed: 'Closed',
  annulled: 'Annulled',
};

// node_id like "kommons.index" → the space (korner) it's about.
const spaceSlug = (nodeId: string | null): string | undefined =>
  nodeId?.split('.')[0];

export const ProposalCard: React.FC<{
  proposal: Proposal;
  onSelect: (id: string) => void;
}> = ({ proposal, onSelect }) => {
  const handleClick = useCallback(() => {
    onSelect(proposal.id);
  }, [onSelect, proposal.id]);

  const { backing } = proposal;
  const slug = spaceSlug(proposal.node_id);
  const korner = useKorner(slug);
  const spaceLabel = slug ? (korner?.name ?? slug) : null;
  // Waving-hand alert when this proposal has an unread notification
  // (e.g. its work was just marked actioned).
  const hasAlert = useAppSelector(selectUnreadProposalIds).has(proposal.id);

  return (
    <button
      type='button'
      className={classNames(
        'kommons-proposal',
        `kommons-proposal--${proposal.status}`,
      )}
      onClick={handleClick}
    >
      <span className='kommons-proposal__main'>
        <span className='kommons-proposal__title'>
          {hasAlert && (
            <WavingHandBadge
              className='kommons-proposal__alert'
              label='New activity'
            />
          )}
          {proposal.title}
        </span>
        {proposal.summary && (
          <span className='kommons-proposal__summary'>{proposal.summary}</span>
        )}
        <span className='kommons-proposal__meta'>
          {spaceLabel && <span>{spaceLabel}</span>}
          <span>@{proposal.created_by_account.username}</span>
          {proposal.status === 'claimed' && proposal.claimed_by_account ? (
            <span>
              <FormattedMessage
                id='governance.card.claimed_by'
                defaultMessage='claimed by @{name}'
                values={{ name: proposal.claimed_by_account.username }}
              />
            </span>
          ) : (
            proposal.status !== 'open' && (
              <span>{STATUS_LABELS[proposal.status]}</span>
            )
          )}
          {backing.my_stake > 0 && (
            <span className='kommons-proposal__mystake'>
              <FormattedMessage
                id='governance.card.my_stake'
                defaultMessage='you backed ₭{stake}'
                values={{ stake: backing.my_stake }}
              />
            </span>
          )}
        </span>
      </span>
      {backing.total > 0 && (
        <span className='kommons-proposal__backing'>₭{backing.total}</span>
      )}
    </button>
  );
};
