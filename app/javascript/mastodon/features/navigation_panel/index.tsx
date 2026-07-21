import { useCallback, useEffect, useRef } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import classNames from 'classnames';
import { Link, useLocation } from 'react-router-dom';

import type { Map as ImmutableMap } from 'immutable';

import { animated, useSpring } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';

import kronkWordmark from '@/images/kronk-wordmark-small.png';
import AddIcon from '@/material-icons/400-24px/add.svg?react';
import BarChartActiveIcon from '@/material-icons/400-24px/bar_chart_4_bars-fill.svg?react';
import BarChartIcon from '@/material-icons/400-24px/bar_chart_4_bars.svg?react';
import CalendarMonthActiveIcon from '@/material-icons/400-24px/calendar_month-fill.svg?react';
import CalendarMonthIcon from '@/material-icons/400-24px/calendar_month.svg?react';
import Diversity2ActiveIcon from '@/material-icons/400-24px/diversity_2-fill.svg?react';
import Diversity2Icon from '@/material-icons/400-24px/diversity_2.svg?react';
import GavelActiveIcon from '@/material-icons/400-24px/gavel-fill.svg?react';
import GavelIcon from '@/material-icons/400-24px/gavel.svg?react';
import HeadphonesActiveIcon from '@/material-icons/400-24px/headphones-fill.svg?react';
import HeadphonesIcon from '@/material-icons/400-24px/headphones.svg?react';
import HomeActiveIcon from '@/material-icons/400-24px/home-fill.svg?react';
import HomeIcon from '@/material-icons/400-24px/home.svg?react';
import InfoIcon from '@/material-icons/400-24px/info.svg?react';
import MenuIcon from '@/material-icons/400-24px/menu.svg?react';
import PartnerExchangeActiveIcon from '@/material-icons/400-24px/partner_exchange-fill.svg?react';
import PartnerExchangeIcon from '@/material-icons/400-24px/partner_exchange.svg?react';
import PersonAddActiveIcon from '@/material-icons/400-24px/person_add-fill.svg?react';
import PersonAddIcon from '@/material-icons/400-24px/person_add.svg?react';
import PublicActiveIcon from '@/material-icons/400-24px/public-fill.svg?react';
import PublicIcon from '@/material-icons/400-24px/public.svg?react';
import QuestionMarkActiveIcon from '@/material-icons/400-24px/question_mark-fill.svg?react';
import QuestionMarkIcon from '@/material-icons/400-24px/question_mark.svg?react';
import SettingsIcon from '@/material-icons/400-24px/settings.svg?react';
import { fetchFollowRequests } from 'mastodon/actions/accounts';
import { openModal } from 'mastodon/actions/modal';
import {
  openNavigation,
  closeNavigation,
  toggleCollapse,
} from 'mastodon/actions/navigation';
import { Account } from 'mastodon/components/account';
import { IconWithBadge } from 'mastodon/components/icon_with_badge';
import { Search } from 'mastodon/features/compose/components/search';
import { ColumnLink } from 'mastodon/features/ui/components/column_link';
import { useBreakpoint } from 'mastodon/features/ui/hooks/useBreakpoint';
import { useIdentity } from 'mastodon/identity_context';
import { me } from 'mastodon/initial_state';
import { transientSingleColumn } from 'mastodon/is_mobile';
import { selectUnreadNudgesCount } from 'mastodon/selectors/notifications';
import { useAppSelector, useAppDispatch } from 'mastodon/store';

import { DisabledAccountBanner } from './components/disabled_account_banner';
import { MoreLink } from './components/more_link';
import { SignInBanner } from './components/sign_in_banner';
import { Trends } from './components/trends';

const messages = defineMessages({
  home: { id: 'tabs_bar.home', defaultMessage: 'Home' },
  notifications: {
    id: 'tabs_bar.notifications',
    defaultMessage: 'Notifications',
  },
  live: { id: 'live.title', defaultMessage: 'Huddle' },
  commons: { id: 'governance.title', defaultMessage: '₭ommons' },
  questions: { id: 'questions.title', defaultMessage: 'Ƙuestions' },
  wachuneed: { id: 'wachuneed.title', defaultMessage: 'Wachuneed' },
  booth: { id: 'booth.title', defaultMessage: 'The Booth' },
  events: { id: 'events.title', defaultMessage: '₭alendar' },
  inFlow: { id: 'inflow.title', defaultMessage: 'Inflow' },
  nudges: { id: 'nudges.title', defaultMessage: 'Nudges' },
  preferences: {
    id: 'navigation_bar.preferences',
    defaultMessage: 'Preferences',
  },
  followsAndFollowers: {
    id: 'navigation_bar.follows_and_followers',
    defaultMessage: 'Follows and followers',
  },
  about: { id: 'navigation_bar.about', defaultMessage: 'About' },
  search: { id: 'navigation_bar.search', defaultMessage: 'Search' },
  searchTrends: {
    id: 'navigation_bar.search_trends',
    defaultMessage: 'Search / Trending',
  },
  advancedInterface: {
    id: 'navigation_bar.advanced_interface',
    defaultMessage: 'Open in advanced web interface',
  },
  openedInClassicInterface: {
    id: 'navigation_bar.opened_in_classic_interface',
    defaultMessage:
      'Posts, accounts, and other specific pages are opened by default in the classic web interface.',
  },
  followRequests: {
    id: 'navigation_bar.follow_requests',
    defaultMessage: 'Follow requests',
  },
  logout: { id: 'navigation_bar.logout', defaultMessage: 'Logout' },
  compose: { id: 'tabs_bar.publish', defaultMessage: 'New Post' },
  invite: { id: 'navigation_panel.invite', defaultMessage: 'Invite' },
});

const NudgesLink: React.FC = () => {
  const count = useAppSelector(selectUnreadNudgesCount);
  const intl = useIntl();

  return (
    <ColumnLink
      transparent
      to='/nudges'
      icon={
        <IconWithBadge
          id='partner_exchange'
          icon={PartnerExchangeIcon}
          count={count}
          className='column-link__icon'
        />
      }
      activeIcon={
        <IconWithBadge
          id='partner_exchange'
          icon={PartnerExchangeActiveIcon}
          count={count}
          className='column-link__icon'
        />
      }
      text={intl.formatMessage(messages.nudges)}
    />
  );
};

const FollowRequestsLink: React.FC = () => {
  const intl = useIntl();
  const count = useAppSelector(
    (state) =>
      (
        state.user_lists.getIn(['follow_requests', 'items']) as
          | ImmutableMap<string, unknown>
          | undefined
      )?.size ?? 0,
  );
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(fetchFollowRequests());
  }, [dispatch]);

  if (count === 0) {
    return null;
  }

  return (
    <ColumnLink
      transparent
      to='/follow_requests'
      icon={
        <IconWithBadge
          id='user-plus'
          icon={PersonAddIcon}
          count={count}
          className='column-link__icon'
        />
      }
      activeIcon={
        <IconWithBadge
          id='user-plus'
          icon={PersonAddActiveIcon}
          count={count}
          className='column-link__icon'
        />
      }
      text={intl.formatMessage(messages.followRequests)}
    />
  );
};

const ProfileCard: React.FC = () => {
  if (!me) {
    return null;
  }

  return (
    <div className='navigation-bar'>
      <Account id={me} minimal size={36} />
    </div>
  );
};

const MENU_WIDTH = 284;

export const NavigationPanel: React.FC<{ multiColumn?: boolean }> = ({
  multiColumn = false,
}) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const { signedIn, disabledAccountId } = useIdentity();
  const location = useLocation();
  const collapsed = useAppSelector((state) => state.navigation.collapsed);
  const showSearch = useBreakpoint('full') && !multiColumn;
  const collapsible = !useBreakpoint('openable');

  const handleCollapseToggle = useCallback(() => {
    dispatch(toggleCollapse());
  }, [dispatch]);

  const handleInviteClick = useCallback(() => {
    dispatch(openModal({ modalType: 'INVITE', modalProps: {} }));
  }, [dispatch]);

  let banner: React.ReactNode;

  if (transientSingleColumn) {
    banner = (
      <div className='switch-to-advanced'>
        {intl.formatMessage(messages.openedInClassicInterface)}{' '}
        <a
          href={`/deck${location.pathname}`}
          className='switch-to-advanced__toggle'
        >
          {intl.formatMessage(messages.advancedInterface)}
        </a>
      </div>
    );
  }

  return (
    <div
      className={classNames('navigation-panel', {
        'navigation-panel--collapsed': collapsed && collapsible,
      })}
    >
      <div className='navigation-panel__logo'>
        <Link to='/' className='column-link column-link--logo'>
          <img
            src={kronkWordmark}
            alt='Kronk'
            style={{ height: '36px', width: 'auto' }}
          />
        </Link>
      </div>

      {collapsible && (
        <button
          className='navigation-panel__collapse-btn'
          onClick={handleCollapseToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <MenuIcon /> : <MenuIcon />}
        </button>
      )}

      {showSearch && <Search singleColumn />}

      {!multiColumn && <ProfileCard />}

      {banner && <div className='navigation-panel__banner'>{banner}</div>}

      <div className='navigation-panel__menu'>
        {signedIn && (
          <>
            {!multiColumn && (
              <ColumnLink
                to='/publish'
                icon='plus'
                iconComponent={AddIcon}
                activeIconComponent={AddIcon}
                text={intl.formatMessage(messages.compose)}
                className='button navigation-panel__compose-button'
              />
            )}
            <ColumnLink
              transparent
              to='/home'
              icon='home'
              iconComponent={HomeIcon}
              activeIconComponent={HomeActiveIcon}
              text={intl.formatMessage(messages.home)}
              tooltip='Your feed'
            />
          </>
        )}

        {signedIn && (
          <ColumnLink
            transparent
            to='/huddle'
            icon='diversity_2'
            iconComponent={Diversity2Icon}
            activeIconComponent={Diversity2ActiveIcon}
            text={intl.formatMessage(messages.live)}
            tooltip='Live video space'
          />
        )}

        {signedIn && (
          <ColumnLink
            transparent
            to='/hub/kalendar'
            icon='calendar_month'
            iconComponent={CalendarMonthIcon}
            activeIconComponent={CalendarMonthActiveIcon}
            text={intl.formatMessage(messages.events)}
            tooltip='₭alendar &amp; Huddles'
          />
        )}

        {signedIn && (
          <ColumnLink
            transparent
            to='/hub/inflow'
            icon='public'
            iconComponent={PublicIcon}
            activeIconComponent={PublicActiveIcon}
            text={intl.formatMessage(messages.inFlow)}
            tooltip='In Flow'
          />
        )}

        {signedIn && (
          <>
            <hr />

            <ColumnLink
              transparent
              to='/hub/kuestions'
              icon='question_mark'
              iconComponent={QuestionMarkIcon}
              activeIconComponent={QuestionMarkActiveIcon}
              text={intl.formatMessage(messages.questions)}
              label={
                <>
                  <span style={{ fontFamily: 'Georgia, serif' }}>Ƙ</span>
                  uestions
                </>
              }
              tooltip='Ƙuestions'
            />

            <ColumnLink
              transparent
              to='/hub/kommons'
              icon='gavel'
              iconComponent={GavelIcon}
              activeIconComponent={GavelActiveIcon}
              text={intl.formatMessage(messages.commons)}
              tooltip='₭ommons'
            />

            <FollowRequestsLink />

            <ColumnLink
              transparent
              to='/hub/wachuneed'
              icon='bar_chart'
              iconComponent={BarChartIcon}
              activeIconComponent={BarChartActiveIcon}
              text={intl.formatMessage(messages.wachuneed)}
            />

            <ColumnLink
              transparent
              to='/hub/booth'
              icon='headphones'
              iconComponent={HeadphonesIcon}
              activeIconComponent={HeadphonesActiveIcon}
              text={intl.formatMessage(messages.booth)}
              tooltip='The Booth — DJ sets &amp; mixes'
            />

            <NudgesLink />

            <hr />

            <ColumnLink
              transparent
              href='/settings/preferences'
              icon='cog'
              iconComponent={SettingsIcon}
              text={intl.formatMessage(messages.preferences)}
            />

            <MoreLink />
          </>
        )}

        <div className='navigation-panel__legal'>
          <ColumnLink
            transparent
            to='/about'
            icon='ellipsis-h'
            iconComponent={InfoIcon}
            text={intl.formatMessage(messages.about)}
          />
        </div>

        {signedIn && (
          <button
            className='button navigation-panel__invite-button'
            onClick={handleInviteClick}
          >
            <PersonAddIcon />
            <span>{intl.formatMessage(messages.invite)}</span>
          </button>
        )}

        {!signedIn && (
          <div className='navigation-panel__sign-in-banner'>
            <hr />

            {disabledAccountId ? <DisabledAccountBanner /> : <SignInBanner />}
          </div>
        )}
      </div>

      <div className='flex-spacer' />

      <Trends />
    </div>
  );
};

export const CollapsibleNavigationPanel: React.FC = () => {
  const open = useAppSelector((state) => state.navigation.open);
  const collapsed = useAppSelector((state) => state.navigation.collapsed);
  const dispatch = useAppDispatch();
  const openable = useBreakpoint('openable');
  const location = useLocation();
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    dispatch(closeNavigation());
  }, [dispatch, location]);

  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (overlayRef.current && e.target === overlayRef.current) {
        dispatch(closeNavigation());
      }
    };

    const handleDocumentKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dispatch(closeNavigation());
      }
    };

    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('keyup', handleDocumentKeyUp);

    return () => {
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('keyup', handleDocumentKeyUp);
    };
  }, [dispatch]);

  const isLtrDir = getComputedStyle(document.body).direction !== 'rtl';

  const OPEN_MENU_OFFSET = isLtrDir ? MENU_WIDTH : -MENU_WIDTH;

  const [{ x }, spring] = useSpring(
    () => ({
      x: open ? 0 : OPEN_MENU_OFFSET,
      onRest: {
        x({ value }: { value: number }) {
          if (value === 0) {
            dispatch(openNavigation());
          } else if (isLtrDir ? value > 0 : value < 0) {
            dispatch(closeNavigation());
          }
        },
      },
    }),
    [open],
  );

  const bind = useDrag(
    ({
      last,
      offset: [xOffset],
      velocity: [xVelocity],
      direction: [xDirection],
      cancel,
    }) => {
      const logicalXDirection = isLtrDir ? xDirection : -xDirection;
      const logicalXOffset = isLtrDir ? xOffset : -xOffset;
      const hasReachedDragThreshold = logicalXOffset < -70;

      if (hasReachedDragThreshold) {
        cancel();
      }

      if (last) {
        const isAboveOpenThreshold = logicalXOffset > MENU_WIDTH / 2;
        const isQuickFlick = xVelocity > 0.5 && logicalXDirection > 0;

        if (isAboveOpenThreshold || isQuickFlick) {
          void spring.start({ x: OPEN_MENU_OFFSET });
        } else {
          void spring.start({ x: 0 });
        }
      } else {
        void spring.start({ x: xOffset, immediate: true });
      }
    },
    {
      from: () => [x.get(), 0],
      filterTaps: true,
      bounds: isLtrDir ? { left: 0 } : { right: 0 },
      rubberband: true,
      enabled: openable,
    },
  );

  const previouslyFocusedElementRef = useRef<HTMLElement | null>();

  useEffect(() => {
    if (open) {
      const firstLink = document.querySelector<HTMLAnchorElement>(
        '.navigation-panel__menu .column-link',
      );
      previouslyFocusedElementRef.current =
        document.activeElement as HTMLElement;
      firstLink?.focus();
    } else {
      previouslyFocusedElementRef.current?.focus();
    }
  }, [open]);

  const showOverlay = openable && open;

  return (
    <div
      className={classNames(
        'columns-area__panels__pane columns-area__panels__pane--start columns-area__panels__pane--navigational',
        {
          'columns-area__panels__pane--overlay': showOverlay,
          'columns-area__panels__pane--collapsed': collapsed && !openable,
        },
      )}
      ref={overlayRef}
    >
      <animated.div
        className='columns-area__panels__pane__inner'
        {...bind()}
        style={openable ? { x } : undefined}
      >
        <NavigationPanel />
      </animated.div>
    </div>
  );
};
