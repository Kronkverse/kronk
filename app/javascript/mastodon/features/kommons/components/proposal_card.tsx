import { useCallback } from 'react';

import { FormattedMessage } from 'react-intl';

import classNames from 'classnames';

import { Icon } from 'mastodon/components/icon';
import {
  StandardCard,
  CardBadge,
  CardTitle,
  CardMeta,
  CardActions,
} from 'mastodon/components/standard_card';
import { WavingHandBadge } from 'mastodon/components/waving_hand_badge';
import { useKorner } from 'mastodon/hooks/useKorner';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';
import { selectUnreadProposalIds } from 'mastodon/selectors/notifications';
import { useAppSelector } from 'mastodon/store';

import type { Proposal } from '../types';

// A proposal on the Kommons board. Redesign 2026-08-06 (Tal:
// "kommons space is chaotic"): the old busy left-hand backing ring
// is out; each card now leads with the icon of the korner the
// proposal targets (read from that korner's manifest via
// `useKornerIcon`), the title + author sit in the middle, and the
// ₭-backed count parks on the right as a small numeric column.
// Support here is still token backing, not votes.
//
// Moved onto <StandardCard> and its slots 2026-09-11 (the card standard,
// docs/kronk_card_standard.md). The text-led half of the proof: a proposal
// has no image, so it fills badge/title/meta/actions and leaves media out.
//
// Stripped back 2026-09-12 (Tal: "the cards feel way too busy now, its
// vaguely overwhelming"). The first pass kept every piece of information the
// three-column card had and stacked it, which put five things on one line
// under the title, two of them bordered chips. Now the title is the loudest
// thing on the card and everything else is one quiet grey run: korner,
// author, backers, and the status only when it is something other than open.
//
// Gone from the card: the size chip and the step count. Both are decision
// information rather than scanning information — you want them once you are
// reading a proposal, not while you are running your eye down a board of
// seventeen. Both live on the proposal page (size was added there in the
// same change; steps were already there).
//
// node_id like "kommons.index" → the space (korner) it's about.
// Space name is resolved via `useKorner()` off the same manifest
// registry `useKornerIcon` uses — one source of truth (2026-09-05,
// retired a hand-maintained SPACE_LABELS map that drifted).

const STATUS_LABELS: Record<Proposal['status'], string> = {
  open: 'Open',
  delivered: 'Delivered',
  completed: 'Completed',
  annulled: 'Annulled',
};

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
  const KornerIconComponent = useKornerIcon(slug);

  // Waving-hand alert when this proposal has an unread notification
  // (e.g. its work was just marked complete).
  const hasAlert = useAppSelector(selectUnreadProposalIds).has(proposal.id);

  return (
    <StandardCard
      as='button'
      variant='flow'
      className={classNames(
        'kommons-proposal',
        `kommons-proposal--${proposal.status}`,
      )}
      onClick={handleClick}
    >
      {backing.my_stake > 0 && (
        <span className='kommons-proposal__mystake'>
          ₭{backing.my_stake} staked
        </span>
      )}

      <CardTitle className='kommons-proposal__title'>
        {hasAlert && (
          <WavingHandBadge
            className='kommons-proposal__alert'
            label='New activity'
          />
        )}
        {proposal.title}
      </CardTitle>

      {/* Badge — which korner the proposal is about, wearing that korner's
          own manifest icon. Sits on the same line as the meta run rather
          than above the title: on a board where every card is a proposal,
          the korner is a fact about the proposal, not a heading over it. */}
      <CardBadge className='kommons-proposal__badge'>
        <Icon id={`space-${slug ?? 'unknown'}`} icon={KornerIconComponent} />
        {spaceLabel}
      </CardBadge>

      <CardMeta className='kommons-proposal__meta'>
        <span className='kommons-proposal__proposer'>
          {proposal.created_by_account.avatar && (
            <img
              className='kommons-proposal__avatar'
              src={proposal.created_by_account.avatar}
              alt=''
              aria-hidden='true'
            />
          )}
          @{proposal.created_by_account.username}
        </span>
        <span className='kommons-proposal__m'>
          <FormattedMessage
            id='governance.card.backers'
            defaultMessage='{count, plural, one {# backer} other {# backers}}'
            values={{ count: backing.backers }}
          />
        </span>
        {proposal.status !== 'open' && (
          <span
            className={`kommons-proposal__statuschip kommons-proposal__statuschip--${proposal.status}`}
          >
            {STATUS_LABELS[proposal.status]}
          </span>
        )}
      </CardMeta>

      {/* Koin backed — the board's primary quantitative signal, so it
          keeps its top-right corner here. In an arrangement that hides
          actions (a grid tile in another space) it simply drops away,
          which is the right call for a number that only means anything
          next to other proposals. */}
      <CardActions className='kommons-proposal__backing'>
        <span className='kommons-proposal__backing-num'>₭{backing.total}</span>
        <span className='kommons-proposal__backing-label'>
          <FormattedMessage
            id='governance.card.backed'
            defaultMessage='backed'
          />
        </span>
      </CardActions>
    </StandardCard>
  );
};
