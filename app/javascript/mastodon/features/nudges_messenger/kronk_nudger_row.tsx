import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import KronkCoinIcon from '@/material-icons/400-24px/kronk_coin.svg?react';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';
import type { NotificationGroupProposalComplete } from 'mastodon/models/notification_group';
import { useAppSelector } from 'mastodon/store';

import { KRONK_CONVERSATION_ID, isKronkSystemType } from './kronk_system';

const messages = defineMessages({
  name: { id: 'nudges.kronk.name', defaultMessage: 'Kronk' },
});

interface Props {
  active: boolean;
  onOpen: (id: string) => void;
}

// The pinned "Kronk" conversation row at the top of the messenger
// sidebar. Renders nothing until there's at least one korner/system
// notification to show. Reuses the standard nudges-row chrome.
export const KronkNudgerRow: React.FC<Props> = ({ active, onOpen }) => {
  const intl = useIntl();

  const groups = useAppSelector((state) =>
    [
      ...state.notificationGroups.groups,
      ...state.notificationGroups.pendingGroups,
    ].filter((g): g is NotificationGroupProposalComplete =>
      isKronkSystemType(g.type),
    ),
  );

  const handleClick = useCallback(() => {
    onOpen(KRONK_CONVERSATION_ID);
  }, [onOpen]);

  if (groups.length === 0) return null;

  const latest = [...groups].sort((a, b) =>
    b.latest_page_notification_at.localeCompare(a.latest_page_notification_at),
  )[0];

  return (
    <li
      className={`nudges-row nudges-row--kronk ${active ? 'nudges-row--active' : ''}`}
    >
      <button
        type='button'
        className='nudges-row__button'
        onClick={handleClick}
      >
        <span className='nudges-row__avatar'>
          <span
            className='nudges-row__krew-avatar'
            aria-label={intl.formatMessage(messages.name)}
            title={intl.formatMessage(messages.name)}
          >
            <KronkCoinIcon />
          </span>
        </span>
        <span className='nudges-row__body'>
          <span className='nudges-row__head'>
            <span className='nudges-row__name'>
              {intl.formatMessage(messages.name)}
            </span>
            {latest?.latest_page_notification_at && (
              <span className='nudges-row__time'>
                <RelativeTimestamp
                  timestamp={latest.latest_page_notification_at}
                  short
                />
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
};
