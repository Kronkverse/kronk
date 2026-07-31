import { useCallback, useEffect, useRef, useState } from 'react';

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
import MailIcon from '@/material-icons/400-24px/mail-fill.svg?react';
import { submitMarkers } from 'mastodon/actions/markers';
import { markNotificationsAsRead } from 'mastodon/actions/notification_groups';
import { Icon } from 'mastodon/components/icon';
import type {
  NotificationGroupEmailConfirmationReminder,
  NotificationGroupProposalComplete,
} from 'mastodon/models/notification_group';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

import type { KronkSystemGroup } from './kronk_system';
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
  systemNoReply: {
    id: 'nudges.kronk.no_reply',
    defaultMessage:
      'System messages — pick a card above to follow up on Kommons.',
  },
  confirmEmailTitle: {
    id: 'nudges.kronk.confirm_email.title',
    defaultMessage: 'Confirm your email',
  },
  confirmEmailBodyWithEmail: {
    id: 'nudges.kronk.confirm_email.body_with_email',
    defaultMessage:
      'Check your inbox for the link we sent to {email}. Not there? Resend or change the address.',
  },
  confirmEmailBody: {
    id: 'nudges.kronk.confirm_email.body',
    defaultMessage:
      'Check your inbox for the confirmation link. Not there? Resend or change the address.',
  },
  confirmEmailCta: {
    id: 'nudges.kronk.confirm_email.cta',
    defaultMessage: 'Resend or change email',
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

interface EmailConfirmationReminderMessageProps {
  group: NotificationGroupEmailConfirmationReminder;
}

const EmailConfirmationReminderMessage: React.FC<
  EmailConfirmationReminderMessageProps
> = ({ group }) => {
  const intl = useIntl();
  const email = group.emailConfirmationEmail;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        maxWidth: '32rem',
      }}
    >
      {/* Deep-link to /auth/setup, the Devise-side resend/change-email
          page. Full nav (not <Link>): the setup surface is Rails-served
          and outside the SPA. */}
      <a href='/auth/setup' className='notification-event-card'>
        <div className='notification-event-card__info'>
          <div className='notification-event-card__title'>
            <Icon id='mail' icon={MailIcon} />
            {intl.formatMessage(messages.confirmEmailTitle)}
          </div>
          <div className='notification-event-card__meta'>
            {email
              ? intl.formatMessage(messages.confirmEmailBodyWithEmail, {
                  email,
                })
              : intl.formatMessage(messages.confirmEmailBody)}
          </div>
          <div
            className='notification-event-card__meta'
            style={{ marginTop: '0.25rem', opacity: 0.85 }}
          >
            {intl.formatMessage(messages.confirmEmailCta)}
          </div>
        </div>
      </a>
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
  const streamRef = useRef<HTMLDivElement>(null);

  const groups = useAppSelector((state) =>
    [
      ...state.notificationGroups.groups,
      ...state.notificationGroups.pendingGroups,
    ].filter((g): g is KronkSystemGroup => isKronkSystemType(g.type)),
  );

  // Opening the Kronk system pane is the "I've read this" signal for
  // korner/system notifications — advance the read marker so the raven
  // pillar drops its waving-hand alert. `markNotificationsAsRead` only
  // moves the client-side `readMarkerId`; without an immediate
  // `submitMarkers` the server never learns, and a page reload before
  // the window next regains focus (the only other flush trigger, in
  // features/ui/index.jsx:444) resurrects the badge from the stale
  // server marker.
  useEffect(() => {
    dispatch(markNotificationsAsRead());
    void dispatch(submitMarkers({ immediate: true }));
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

  // Oldest first in DOM order, so the newest card lands at the bottom
  // of the flow — same convention as a chat stream.
  const sorted = [...groups].sort((a, b) =>
    a.latest_page_notification_at.localeCompare(b.latest_page_notification_at),
  );

  // Pin the scroll to the newest card. Simple useLayoutEffect wasn't
  // enough — the cards contain SVG icons whose layout stabilises
  // AFTER the first paint, so an early scrollTop write got clobbered
  // when the container's scrollHeight grew again. Wire a
  // ResizeObserver on the container so any subsequent grow event
  // re-pins to bottom, and use a double-rAF for the initial mount so
  // we run after the browser has committed layout.
  useEffect(() => {
    const el = streamRef.current;
    if (!el) return;
    const pin = () => {
      el.scrollTop = el.scrollHeight;
    };
    const rafIds: number[] = [];
    rafIds.push(
      requestAnimationFrame(() => {
        rafIds.push(requestAnimationFrame(pin));
      }),
    );

    // Ongoing: any time the container's scrollable area grows (SVG
    // reflow, images loading, new items appended) — re-pin to bottom
    // unless the user has scrolled up on purpose (>200px from bottom).
    const ro = new ResizeObserver(() => {
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom < 200) pin();
    });
    ro.observe(el);
    for (const child of Array.from(el.children)) {
      ro.observe(child);
    }

    return () => {
      rafIds.forEach((id) => {
        cancelAnimationFrame(id);
      });
      ro.disconnect();
    };
  }, [sorted.length]);

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
        ref={streamRef}
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          padding: '1.25rem 1rem',
        }}
      >
        {sorted.length === 0 && (
          <p style={{ color: 'var(--text-muted)' }}>
            {intl.formatMessage(messages.empty)}
          </p>
        )}
        {sorted.map((group) => {
          if (group.type === 'email_confirmation_reminder') {
            return (
              <EmailConfirmationReminderMessage
                key={group.group_key}
                group={group}
              />
            );
          }
          return (
            <ProposalCompleteMessage
              key={group.group_key}
              group={group}
              visited={
                group.proposal ? visited.has(group.proposal.proposal_id) : false
              }
              onVisit={handleVisit}
            />
          );
        })}
      </div>

      {/*
        System pane has no reply composer — nothing consumes what you'd
        type back to Kronk. The band matches the composer's chrome so
        the layout doesn't feel truncated: everywhere else in the
        messenger there's a bar under the stream.
      */}
      <div
        style={{
          flex: '0 0 auto',
          padding: '0.75rem 1rem',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--surface-primary)',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
          textAlign: 'center',
        }}
      >
        {intl.formatMessage(messages.systemNoReply)}
      </div>
    </div>
  );
};
