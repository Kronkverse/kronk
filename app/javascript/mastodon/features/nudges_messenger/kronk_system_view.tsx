import { useCallback, useEffect, useState } from 'react';

import {
  defineMessages,
  FormattedDate,
  FormattedMessage,
  FormattedTime,
  useIntl,
} from 'react-intl';

import { Link } from 'react-router-dom';

import DoneAllIcon from '@/material-icons/400-24px/done_all.svg?react';
import KronkCoinIcon from '@/material-icons/400-24px/kronk_coin.svg?react';
import { markNotificationsAsRead } from 'mastodon/actions/notification_groups';
import { Icon } from 'mastodon/components/icon';
import type { NotificationGroupProposalComplete } from 'mastodon/models/notification_group';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

import { isKronkSystemType } from './kronk_system';

// Cards the user has clicked into stay flagged as "visited" locally
// so unresolved notifications remain visually distinct from ones the
// user has already followed up on. Kept client-side (no server round
// trip) since the concept is UI hygiene, not authoritative state — the
// canonical Delivered → Complete lifecycle still lives on the proposal.
const VISITED_KEY = 'kronk.nudges.system.visited';

// AEST is the operator's timezone — the entire team + shadow deploys
// are anchored to Sydney, so an absolute time is more useful than a
// relative one for triaging what still needs a response.
const TIMEZONE = 'Australia/Sydney';

const messages = defineMessages({
  name: { id: 'nudges.kronk.name', defaultMessage: 'Kronk' },
  description: {
    id: 'nudges.kronk.description',
    defaultMessage: 'System messages from Kronk',
  },
  empty: {
    id: 'nudges.kronk.empty',
    defaultMessage: 'Nothing from Kronk yet.',
  },
});

const readVisited = (): Set<string> => {
  try {
    const raw = localStorage.getItem(VISITED_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((v): v is string => typeof v === 'string'))
      : new Set();
  } catch {
    return new Set();
  }
};

const writeVisited = (set: Set<string>): void => {
  try {
    localStorage.setItem(VISITED_KEY, JSON.stringify([...set]));
  } catch {
    // localStorage can be blocked; a silent failure just means the
    // visited state doesn't persist — the click still opens the card.
  }
};

interface ProposalCompleteMessageProps {
  group: NotificationGroupProposalComplete;
  visited: boolean;
  onVisit: (proposalId: string) => void;
}

const ProposalCompleteMessage: React.FC<ProposalCompleteMessageProps> = ({
  group,
  visited,
  onVisit,
}) => {
  const proposal = group.proposal;
  const handleClick = useCallback(() => {
    if (proposal) onVisit(proposal.proposal_id);
  }, [proposal, onVisit]);

  if (!proposal) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        maxWidth: '32rem',
      }}
    >
      <Link
        to={`/hub/kommons/p/${proposal.proposal_id}`}
        className={`notification-event-card${visited ? ' notification-event-card--visited' : ''}`}
        onClick={handleClick}
      >
        <div className='notification-event-card__info'>
          <div className='notification-event-card__title'>
            <Icon id='done_all' icon={DoneAllIcon} />
            {proposal.proposal_title}
          </div>
          <div className='notification-event-card__meta'>
            {visited ? (
              <FormattedMessage
                id='notification.proposal_complete.followed_up'
                defaultMessage='Followed up'
              />
            ) : (
              <FormattedMessage
                id='notification.proposal_complete.ready'
                defaultMessage='Ready to finalise'
              />
            )}
          </div>
        </div>
      </Link>
      {group.latest_page_notification_at && (
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          <FormattedTime
            value={group.latest_page_notification_at}
            timeZone={TIMEZONE}
            hour='2-digit'
            minute='2-digit'
          />
          {' · '}
          <FormattedDate
            value={group.latest_page_notification_at}
            timeZone={TIMEZONE}
            day='numeric'
            month='short'
          />
          {' AEST'}
        </span>
      )}
    </div>
  );
};

// The Kronk system conversation pane — rendered in the messenger when the
// route is `/nudges/kronk`. Reads the korner/system notification groups
// already in the store and lays them out as a simple message stream.
export const KronkSystemView: React.FC = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();

  const groups = useAppSelector((state) =>
    [
      ...state.notificationGroups.groups,
      ...state.notificationGroups.pendingGroups,
    ].filter((g): g is NotificationGroupProposalComplete =>
      isKronkSystemType(g.type),
    ),
  );

  // Opening the Kronk system pane is the "I've read this" signal for
  // korner/system notifications — advance the read marker so the raven
  // pillar drops its waving-hand alert.
  useEffect(() => {
    dispatch(markNotificationsAsRead());
  }, [dispatch]);

  const [visited, setVisited] = useState<Set<string>>(() => readVisited());

  const handleVisit = useCallback((proposalId: string) => {
    setVisited((prev) => {
      if (prev.has(proposalId)) return prev;
      const next = new Set(prev);
      next.add(proposalId);
      writeVisited(next);
      return next;
    });
  }, []);

  // Newest first — the stream container below uses column-reverse
  // (Signal-style), so DOM order [newest, ..., oldest] renders as
  // [oldest at top, newest at bottom] visually, and the scroll sits
  // pinned to the bottom on mount without any manual scrollIntoView.
  const sorted = [...groups].sort((a, b) =>
    b.latest_page_notification_at.localeCompare(a.latest_page_notification_at),
  );

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
      className='nudges-kronk-view'
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.85rem 1rem',
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        <span
          className='nudges-row__krew-avatar'
          aria-hidden
          style={{ flex: '0 0 auto' }}
        >
          <KronkCoinIcon />
        </span>
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {intl.formatMessage(messages.name)}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            {intl.formatMessage(messages.description)}
          </div>
        </div>
      </header>

      <div
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column-reverse',
          gap: '1.25rem',
          padding: '1.25rem 1rem',
        }}
      >
        {sorted.length === 0 && (
          <p style={{ color: 'var(--text-muted)' }}>
            {intl.formatMessage(messages.empty)}
          </p>
        )}
        {sorted.map((group) => (
          <ProposalCompleteMessage
            key={group.group_key}
            group={group}
            visited={
              group.proposal ? visited.has(group.proposal.proposal_id) : false
            }
            onVisit={handleVisit}
          />
        ))}
      </div>
    </div>
  );
};
