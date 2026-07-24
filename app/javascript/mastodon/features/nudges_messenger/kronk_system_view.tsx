import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import DoneAllIcon from '@/material-icons/400-24px/done_all.svg?react';
import KronkCoinIcon from '@/material-icons/400-24px/kronk_coin.svg?react';
import { Icon } from 'mastodon/components/icon';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';
import type { NotificationGroupProposalComplete } from 'mastodon/models/notification_group';
import { useAppSelector } from 'mastodon/store';

import { isKronkSystemType } from './kronk_system';

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

const ProposalCompleteMessage: React.FC<{
  group: NotificationGroupProposalComplete;
}> = ({ group }) => {
  const proposal = group.proposal;
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
      <p style={{ margin: 0, color: 'var(--text-primary)', lineHeight: 1.5 }}>
        <FormattedMessage
          id='nudges.kronk.proposal_complete'
          defaultMessage='The work on your proposal “{title}” is complete — ready to finalise.'
          values={{ title: proposal.proposal_title }}
        />
      </p>
      <Link
        to={`/hub/kommons/p/${proposal.proposal_id}`}
        className='notification-event-card'
      >
        <div className='notification-event-card__info'>
          <div className='notification-event-card__title'>
            <Icon id='done_all' icon={DoneAllIcon} />
            {proposal.proposal_title}
          </div>
          <div className='notification-event-card__meta'>
            <FormattedMessage
              id='notification.proposal_complete.ready'
              defaultMessage='Ready to finalise'
            />
          </div>
        </div>
      </Link>
      {group.latest_page_notification_at && (
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          <RelativeTimestamp timestamp={group.latest_page_notification_at} />
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

  const groups = useAppSelector((state) =>
    [
      ...state.notificationGroups.groups,
      ...state.notificationGroups.pendingGroups,
    ].filter((g): g is NotificationGroupProposalComplete =>
      isKronkSystemType(g.type),
    ),
  );

  const sorted = [...groups].sort((a, b) =>
    a.latest_page_notification_at.localeCompare(b.latest_page_notification_at),
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
        {sorted.map((group) => (
          <ProposalCompleteMessage key={group.group_key} group={group} />
        ))}
      </div>
    </div>
  );
};
