import { useCallback } from 'react';

import { FormattedMessage } from 'react-intl';

import classNames from 'classnames';

import ChatBubbleIcon from '@/material-icons/400-24px/chat_bubble.svg?react';
import ConstructionIcon from '@/material-icons/400-24px/construction.svg?react';
import AttachFileIcon from '@/material-icons/400-24px/description.svg?react';
import { Icon } from 'mastodon/components/icon';
import {
  StandardCard,
  CardBadge,
  CardTitle,
  CardBody,
  CardMeta,
  CardActions,
} from 'mastodon/components/standard_card';
import { WavingHandBadge } from 'mastodon/components/waving_hand_badge';
import { useKorner } from 'mastodon/hooks/useKorner';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';
import { selectUnreadProposalIds } from 'mastodon/selectors/notifications';
import { useAppSelector } from 'mastodon/store';

import type { Proposal } from '../types';

// A proposal as a tile on the Kommons board (and on node / Space pages).
//
// Tile grid, 2026-10-10 (Tal: the old single column was "an endless list of
// hard-to-differentiate cards… it makes the eyes glaze over"). Every card
// had the same five things, four of them identical card to card (@tal, the
// avatar, "0 backers", "₭0 BACKED"), and nothing big enough to tell one from
// the next. Now each tile:
//
//   [space icon] SPACE                       ₭10
//                                         1 backer
//   Title
//   Summary — what's being asked (two lines)
//   │ @someone  the latest comment           (when there is one)
//   ⚒ @pargo is building this               (when claimed)
//   (P) @proposer                    💬 3  📎 1
//
// The big space icon is what makes the tiles different from each other —
// spaces differ by icon, never colour. Every extra line only appears when
// there's something real behind it; nothing reads "0". All tiles are the
// same size (Tal: no bento).

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
  const KornerIconComponent = useKornerIcon(slug);
  // Waving-hand alert when this proposal has an unread notification
  // (e.g. its work was just marked actioned).
  const hasAlert = useAppSelector(selectUnreadProposalIds).has(proposal.id);
  const builder =
    proposal.status === 'claimed' ? proposal.claimed_by_account : null;

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
      <CardBadge className='kommons-proposal__badge'>
        <span className='kommons-proposal__icon'>
          <Icon id={`space-${slug ?? 'unknown'}`} icon={KornerIconComponent} />
        </span>
        <span className='kommons-proposal__space'>{spaceLabel}</span>
      </CardBadge>

      {backing.total > 0 && (
        <CardActions className='kommons-proposal__backing'>
          <span className='kommons-proposal__backing-num'>
            ₭{backing.total}
          </span>
          <span className='kommons-proposal__backing-label'>
            {backing.my_stake > 0 ? (
              <FormattedMessage
                id='governance.card.my_stake'
                defaultMessage='you backed ₭{stake}'
                values={{ stake: backing.my_stake }}
              />
            ) : (
              <FormattedMessage
                id='governance.card.backers'
                defaultMessage='{count, plural, one {# backer} other {# backers}}'
                values={{ count: backing.backers }}
              />
            )}
          </span>
        </CardActions>
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

      <CardBody className='kommons-proposal__body'>
        {proposal.summary && (
          <p className='kommons-proposal__summary'>{proposal.summary}</p>
        )}
        {proposal.latest_comment && (
          <p className='kommons-proposal__quote'>
            <span className='kommons-proposal__quote-who'>
              @{proposal.latest_comment.username}
            </span>{' '}
            {proposal.latest_comment.body}
          </p>
        )}
        {builder && (
          <span className='kommons-proposal__builder'>
            <Icon id='construction' icon={ConstructionIcon} />
            <FormattedMessage
              id='governance.card.building'
              defaultMessage='@{name} is building this'
              values={{ name: builder.username }}
            />
          </span>
        )}
        {proposal.status !== 'open' && proposal.status !== 'claimed' && (
          <span className='kommons-proposal__state'>
            {STATUS_LABELS[proposal.status]}
          </span>
        )}
      </CardBody>

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
        {proposal.comments_count > 0 && (
          <span className='kommons-proposal__signal'>
            <Icon id='chat_bubble' icon={ChatBubbleIcon} />
            {proposal.comments_count}
          </span>
        )}
        {proposal.attachments_count > 0 && (
          <span className='kommons-proposal__signal'>
            <Icon id='attach_file' icon={AttachFileIcon} />
            {proposal.attachments_count}
          </span>
        )}
      </CardMeta>
    </StandardCard>
  );
};
