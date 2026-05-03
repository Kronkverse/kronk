import { useCallback } from 'react';

import { Helmet } from 'react-helmet';
import { Link, useHistory } from 'react-router-dom';

import CalendarMonthIcon from '@/material-icons/400-24px/calendar_month-fill.svg?react';
import Diversity2Icon from '@/material-icons/400-24px/diversity_2-fill.svg?react';
import GavelIcon from '@/material-icons/400-24px/gavel-fill.svg?react';
import HomeIcon from '@/material-icons/400-24px/home-fill.svg?react';
import NotificationsIcon from '@/material-icons/400-24px/notifications.svg?react';
import { Icon } from 'mastodon/components/icon';
import { initialState, me } from 'mastodon/initial_state';
import { selectUnreadNotificationGroupsCount } from 'mastodon/selectors/notifications';
import { useAppSelector } from 'mastodon/store';

const STARS: [number, number][] = [
  [8, 12],
  [22, 5],
  [65, 8],
  [85, 15],
  [12, 32],
  [78, 28],
  [45, 4],
  [92, 42],
  [3, 58],
  [55, 72],
  [88, 65],
  [30, 88],
  [18, 48],
  [70, 20],
  [40, 75],
];

const SPACES = [
  {
    key: 'murmur',
    label: 'Murmur',
    to: '/home',
    IconComponent: HomeIcon,
    angleDeg: 0,
    floatDelay: 0,
    floatDuration: 4200,
  },
  {
    key: 'kommons',
    label: '₭ommons',
    to: '/governance',
    IconComponent: GavelIcon,
    angleDeg: 90,
    floatDelay: 600,
    floatDuration: 5100,
  },
  {
    key: 'huddle',
    label: 'Huddle',
    to: '/huddle',
    IconComponent: Diversity2Icon,
    angleDeg: 180,
    floatDelay: 1200,
    floatDuration: 4600,
  },
  {
    key: 'kalendar',
    label: 'Kalendar',
    to: '/events',
    IconComponent: CalendarMonthIcon,
    angleDeg: 270,
    floatDelay: 1800,
    floatDuration: 6200,
  },
] as const;

const ORBIT_RADIUS = 130;
const CONTAINER_SIZE = ORBIT_RADIUS * 2 + 100;
const BUBBLE_SIZE = 62;
const PROFILE_SIZE = 72;
const COL_WIDTH = BUBBLE_SIZE + 20;

function orbitPos(angleDeg: number): { left: number; top: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    left: CONTAINER_SIZE / 2 + Math.cos(rad) * ORBIT_RADIUS - COL_WIDTH / 2,
    top: CONTAINER_SIZE / 2 + Math.sin(rad) * ORBIT_RADIUS - BUBBLE_SIZE / 2,
  };
}

const account = me ? initialState?.accounts[me] : undefined;
const rawDisplayName = account?.display_name ?? '';
const displayName =
  rawDisplayName !== '' ? rawDisplayName : (account?.username ?? 'You');
const initial = displayName.trim()[0]?.toUpperCase() ?? '?';
const acct = account?.acct;

const Hub: React.FC = () => {
  const history = useHistory();
  const notifCount = useAppSelector(selectUnreadNotificationGroupsCount);

  const handleNotifications = useCallback(() => {
    history.push('/notifications');
  }, [history]);

  const handleProfile = useCallback(() => {
    if (acct) history.push(`/@${acct}`);
  }, [history]);

  return (
    <div className='hub'>
      <div className='hub__stars' aria-hidden='true'>
        {STARS.map(([x, y], i) => (
          <div
            key={i}
            className='hub__star'
            style={{ left: `${x}%`, top: `${y}%` }}
          />
        ))}
      </div>

      <button
        className='hub__notif-btn'
        onClick={handleNotifications}
        aria-label='Notifications'
      >
        <Icon id='bell' icon={NotificationsIcon} />
        {notifCount > 0 && (
          <span
            className='hub__notif-badge'
            aria-label={`${notifCount} notifications`}
          />
        )}
      </button>

      <div className='hub__orbit-wrap'>
        <div
          className='hub__orbit'
          style={{ width: CONTAINER_SIZE, height: CONTAINER_SIZE }}
        >
          {SPACES.map((space) => {
            const { left, top } = orbitPos(space.angleDeg);
            return (
              <Link
                key={space.key}
                to={space.to}
                className='hub__bubble-col'
                style={{
                  left,
                  top,
                  width: COL_WIDTH,
                  animationDelay: `${space.floatDelay}ms`,
                  animationDuration: `${space.floatDuration}ms`,
                }}
              >
                <div
                  className='hub__bubble'
                  style={{ width: BUBBLE_SIZE, height: BUBBLE_SIZE }}
                >
                  <Icon
                    id={space.key}
                    icon={space.IconComponent}
                    className='hub__bubble-icon'
                  />
                </div>
                <span className='hub__bubble-label'>{space.label}</span>
              </Link>
            );
          })}

          <button
            className='hub__profile'
            onClick={handleProfile}
            aria-label={`Profile: ${displayName}`}
            style={{
              width: PROFILE_SIZE,
              height: PROFILE_SIZE,
              left: (CONTAINER_SIZE - PROFILE_SIZE) / 2,
              top: (CONTAINER_SIZE - PROFILE_SIZE) / 2,
            }}
          >
            {initial}
          </button>
        </div>
      </div>

      <Helmet>
        <title>Kronk</title>
        <meta name='robots' content='noindex' />
      </Helmet>
    </div>
  );
};

// eslint-disable-next-line import/no-default-export
export default Hub;
