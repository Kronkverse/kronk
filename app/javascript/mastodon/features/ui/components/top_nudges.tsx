import { defineMessages, useIntl } from 'react-intl';

import { NavLink } from 'react-router-dom';

import { Icon } from 'mastodon/components/icon';
import { useNudgesBadgeSeed } from 'mastodon/features/nudges_messenger/use_nudges_badge_seed';
import { useKorner } from 'mastodon/hooks/useKorner';
import { kornerIcon } from 'mastodon/hooks/useKornerIcon';
import { selectNudgesAlertCount } from 'mastodon/selectors/notifications';
import { useAppSelector } from 'mastodon/store';

// Nudges in the top bar, beside search, on every screen (Tal, 2026-11-01:
// notifications and messages sit apart from the four sections and stay
// one tap away). The number is everything waiting behind it: unread
// chats, unseen notifications and unread korner and system notices.

const messages = defineMessages({
  nudges: { id: 'top_nudges.label', defaultMessage: 'Nudges' },
});

const NudgesCount: React.FC<{ count: number }> = ({ count }) => (
  <span className='top-nudges__badge' role='status' aria-label={`${count} new`}>
    {count > 99 ? '99+' : count}
  </span>
);

export const TopNudges: React.FC = () => {
  const intl = useIntl();
  const alertCount = useAppSelector(selectNudgesAlertCount);
  const korner = useKorner('nudges');
  // Seeds the unread count on boot and keeps it live from the account
  // stream, so the badge is right before Nudges is ever opened.
  useNudgesBadgeSeed();

  const label = intl.formatMessage(messages.nudges);

  return (
    <NavLink
      to='/nudges'
      className='top-nudges'
      activeClassName='top-nudges--active'
      aria-label={label}
      title={label}
      data-walkthrough-anchor='nav-nudges'
    >
      <Icon
        id='nudges'
        icon={kornerIcon('nudges', korner)}
        className='top-nudges__icon'
      />
      {alertCount > 0 && <NudgesCount count={alertCount} />}
    </NavLink>
  );
};
