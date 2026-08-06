import { useCallback } from 'react';

import { FormattedMessage } from 'react-intl';

import DoneAllIcon from '@/material-icons/400-24px/done_all.svg?react';
import GroupIcon from '@/material-icons/400-24px/group.svg?react';
import { Icon } from 'mastodon/components/icon';
import { WavingHandBadge } from 'mastodon/components/waving_hand_badge';
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
  const steps = proposal.task_summary;
  const totalSteps = steps.open + steps.in_progress + steps.done;

  const slug = spaceSlug(proposal.node_id);
  const spaceLabel = slug ? (SPACE_LABELS[slug] ?? slug) : null;
  const KornerIconComponent = useKornerIcon(slug);

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

      {/* Left column — the target korner's own icon, sourced from its
          manifest. Chip is decorative (aria-hidden); the korner name
          still reads on-screen through the space chip in the body. */}
      <div
        className='kommons-proposal__space-icon'
        aria-hidden='true'
        title={spaceLabel ?? undefined}
      >
        <Icon id={`space-${slug ?? 'unknown'}`} icon={KornerIconComponent} />
      </div>

      <div className='kommons-proposal__body'>
        <div className='kommons-proposal__chips'>
          {spaceLabel && (
            <span className='kommons-proposal__space-label'>{spaceLabel}</span>
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
          {totalSteps > 0 && (
            <span className='kommons-proposal__m'>
              <Icon id='done_all' icon={DoneAllIcon} />
              {steps.done}/{totalSteps}
            </span>
          )}
        </div>
      </div>

      {/* Right column — Koin backed, the primary quantitative signal
          for this proposal. Was the centrepiece of the old ring on
          the left; now a small right-aligned numeric readout. */}
      <div className='kommons-proposal__backing'>
        <span className='kommons-proposal__backing-num'>₭{backing.total}</span>
        <span className='kommons-proposal__backing-label'>
          <FormattedMessage
            id='governance.card.backed'
            defaultMessage='backed'
          />
        </span>
      </div>
    </button>
  );
};
