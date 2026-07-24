import { useCallback } from 'react';

import { FormattedMessage } from 'react-intl';

import DoneAllIcon from '@/material-icons/400-24px/done_all.svg?react';
import GroupIcon from '@/material-icons/400-24px/group.svg?react';
import { Icon } from 'mastodon/components/icon';
import { WavingHandBadge } from 'mastodon/components/waving_hand_badge';
import { kornerIcon } from 'mastodon/hooks/useKornerIcon';
import { selectUnreadProposalIds } from 'mastodon/selectors/notifications';
import { useAppSelector } from 'mastodon/store';

import type { Proposal } from '../types';

// A proposal on the Kommons board. Support here is token backing, not votes:
// the card leads with a backing ring (this proposal's staked ₭ relative to the
// strongest-backed one on screen), then backers, rank and steps. The retired
// agree/abstain/block "fans" are gone.

// node_id like "kommons.index" → the space (korner) it's about.
const SPACE_LABELS: Record<string, string> = {
  kommons: 'Kommons',
  profile: 'Profile',
  feed: 'Feed',
  booth: 'The Booth',
  map: 'Map',
  huddle: 'Huddle',
  kalendar: 'Kalendar',
  martketplace: 'mARTketplace',
  kuestions: 'Kuestions',
  inflow: 'InFlow',
  nudges: 'Nudges',
  moments: 'Moments',
  albutts: 'Albutts',
  groups: 'Krews', // Kronk vocab — slug stays `groups`; display label is Krews.
  klot: 'Klot',
  settings: 'Settings',
  kronk: 'Kronk',
};

const SIZE_LABELS: Record<Proposal['proposal_type'], string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
};

const STATUS_LABELS: Record<Proposal['status'], string> = {
  open: 'Open',
  delivered: 'Delivered',
  completed: 'Completed',
  annulled: 'Annulled',
};

const RING_R = 21;
const RING_C = 2 * Math.PI * RING_R;

const spaceSlug = (nodeId: string | null): string | undefined =>
  nodeId?.split('.')[0];

export const ProposalCard: React.FC<{
  proposal: Proposal;
  maxBacking: number;
  onSelect: (id: string) => void;
}> = ({ proposal, maxBacking, onSelect }) => {
  const handleClick = useCallback(() => {
    onSelect(proposal.id);
  }, [onSelect, proposal.id]);

  const { backing } = proposal;
  const steps = proposal.task_summary;
  const totalSteps = steps.open + steps.in_progress + steps.done;
  const ringOffset =
    maxBacking > 0 ? RING_C * (1 - backing.total / maxBacking) : RING_C;

  const slug = spaceSlug(proposal.node_id);
  const spaceLabel = slug ? (SPACE_LABELS[slug] ?? slug) : null;

  // Waving-hand alert when this proposal has an unread notification
  // (e.g. its work was just marked complete).
  const hasAlert = useAppSelector(selectUnreadProposalIds).has(proposal.id);

  return (
    <button
      className={`kommons-proposal kommons-proposal--${proposal.status}`}
      onClick={handleClick}
    >
      {backing.my_stake > 0 && (
        <span className='kommons-proposal__mystake'>
          ₭{backing.my_stake} staked
        </span>
      )}

      <div className='kommons-proposal__gauge'>
        <div className='kommons-proposal__ring'>
          <svg viewBox='0 0 52 52' aria-hidden='true'>
            <circle
              className='kommons-proposal__ring-track'
              cx={26}
              cy={26}
              r={RING_R}
            />
            <circle
              className='kommons-proposal__ring-fill'
              cx={26}
              cy={26}
              r={RING_R}
              strokeDasharray={RING_C.toFixed(1)}
              strokeDashoffset={ringOffset.toFixed(1)}
            />
          </svg>
          <span className='kommons-proposal__ring-num'>{backing.total}</span>
        </div>
        <span className='kommons-proposal__ring-label'>
          <FormattedMessage
            id='governance.card.backed'
            defaultMessage='backed'
          />
        </span>
      </div>

      <div className='kommons-proposal__body'>
        <div className='kommons-proposal__chips'>
          {slug && spaceLabel && (
            <span className='kommons-proposal__space'>
              <Icon id={`space-${slug}`} icon={kornerIcon(slug)} />
              {spaceLabel}
            </span>
          )}
          <span
            className={`kommons-proposal__size kommons-proposal__size--${proposal.proposal_type}`}
          >
            {SIZE_LABELS[proposal.proposal_type]}
          </span>
          {proposal.status !== 'open' && (
            <span
              className={`kommons-proposal__statuschip kommons-proposal__statuschip--${proposal.status}`}
            >
              {STATUS_LABELS[proposal.status]}
            </span>
          )}
        </div>

        <h3 className='kommons-proposal__title'>
          {hasAlert && (
            <WavingHandBadge
              className='kommons-proposal__alert'
              label='New activity'
            />
          )}
          {proposal.title}
        </h3>

        <div className='kommons-proposal__meta'>
          <span className='kommons-proposal__seeder'>
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
            <Icon id='group' icon={GroupIcon} />
            <FormattedMessage
              id='governance.card.backers'
              defaultMessage='{count, plural, one {# backer} other {# backers}}'
              values={{ count: backing.backers }}
            />
          </span>
          {backing.rank !== null && (
            <span className='kommons-proposal__m kommons-proposal__rank'>
              #{backing.rank}
            </span>
          )}
          {totalSteps > 0 && (
            <span className='kommons-proposal__m'>
              <Icon id='done_all' icon={DoneAllIcon} />
              {steps.done}/{totalSteps}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};
