import PropTypes from 'prop-types';
import { PureComponent } from 'react';

import { defineMessages, injectIntl, FormattedMessage } from 'react-intl';

import classNames from 'classnames';
import { Helmet } from 'react-helmet';

import { connect } from 'react-redux';

import CampaignIcon from '@/material-icons/400-24px/campaign.svg?react';
import HomeIcon from '@/material-icons/400-24px/home-fill.svg?react';
import { SymbolLogo } from 'mastodon/components/logo';
import { fetchAnnouncements, toggleShowAnnouncements } from 'mastodon/actions/announcements';
import { IconWithBadge } from 'mastodon/components/icon_with_badge';
import { NotSignedInIndicator } from 'mastodon/components/not_signed_in_indicator';
import { identityContextPropShape, withIdentity } from 'mastodon/identity_context';
import { criticalUpdatesPending } from 'mastodon/initial_state';
import { withBreakpoint } from 'mastodon/features/ui/hooks/useBreakpoint';

import { addColumn, removeColumn, moveColumn } from '../../actions/columns';
import { expandHomeTimeline, expandPublicTimeline, expandCommunityTimeline } from '../../actions/timelines';
import Column from '../../components/column';
import ColumnHeader from '../../components/column_header';
import StatusListContainer from '../ui/containers/status_list_container';

import { ColumnSettings } from './components/column_settings';
import { CriticalUpdateBanner } from './components/critical_update_banner';
import { LiveBanner } from './components/live_banner';
import { Announcements } from './components/announcements';

const messages = defineMessages({
  title: { id: 'column.home', defaultMessage: 'Home' },
  show_announcements: { id: 'home.show_announcements', defaultMessage: 'Show announcements' },
  hide_announcements: { id: 'home.hide_announcements', defaultMessage: 'Hide announcements' },
  tab_friends: { id: 'home.tab.friends', defaultMessage: 'Friends' },
  tab_fof: { id: 'home.tab.fof', defaultMessage: 'Friends of Friends' },
  tab_kommunity: { id: 'home.tab.kommunity', defaultMessage: 'Kommunity' },
});

const mapStateToProps = state => ({
  hasUnread: state.getIn(['timelines', 'home', 'unread']) > 0,
  isPartial: state.getIn(['timelines', 'home', 'isPartial']),
  hasAnnouncements: !state.getIn(['announcements', 'items']).isEmpty(),
  unreadAnnouncements: state.getIn(['announcements', 'items']).count(item => !item.get('read')),
  showAnnouncements: state.getIn(['announcements', 'show']),
});

class HomeTimeline extends PureComponent {
  static propTypes = {
    identity: identityContextPropShape,
    dispatch: PropTypes.func.isRequired,
    intl: PropTypes.object.isRequired,
    hasUnread: PropTypes.bool,
    isPartial: PropTypes.bool,
    columnId: PropTypes.string,
    multiColumn: PropTypes.bool,
    hasAnnouncements: PropTypes.bool,
    unreadAnnouncements: PropTypes.number,
    showAnnouncements: PropTypes.bool,
    matchesBreakpoint: PropTypes.bool,
  };

  state = {
    activeTab: 'friends',
    initializedTabs: { friends: true, fof: false, kommunity: false },
  };

  handlePin = () => {
    const { columnId, dispatch } = this.props;

    if (columnId) {
      dispatch(removeColumn(columnId));
    } else {
      dispatch(addColumn('HOME', {}));
    }
  };

  handleMove = (dir) => {
    const { columnId, dispatch } = this.props;
    dispatch(moveColumn(columnId, dir));
  };

  handleHeaderClick = () => {
    this.column.scrollTop();
  };

  setRef = c => {
    this.column = c;
  };

  handleTabChange = (tab) => {
    const { dispatch } = this.props;
    this.setState(prev => {
      if (!prev.initializedTabs[tab]) {
        if (tab === 'fof') dispatch(expandPublicTimeline({}));
        if (tab === 'kommunity') dispatch(expandCommunityTimeline({}));
        return { activeTab: tab, initializedTabs: { ...prev.initializedTabs, [tab]: true } };
      }
      return { activeTab: tab };
    });
  };

  handleLoadMoreFriends = maxId => {
    this.props.dispatch(expandHomeTimeline({ maxId }));
  };

  handleLoadMoreFof = maxId => {
    this.props.dispatch(expandPublicTimeline({ maxId }));
  };

  handleLoadMoreKommunity = maxId => {
    this.props.dispatch(expandCommunityTimeline({ maxId }));
  };

  componentDidMount () {
    setTimeout(() => this.props.dispatch(fetchAnnouncements()), 700);
    this._checkIfReloadNeeded(false, this.props.isPartial);
  }

  componentDidUpdate (prevProps) {
    this._checkIfReloadNeeded(prevProps.isPartial, this.props.isPartial);
  }

  componentWillUnmount () {
    this._stopPolling();
  }

  _checkIfReloadNeeded (wasPartial, isPartial) {
    const { dispatch } = this.props;

    if (wasPartial === isPartial) {
      return;
    } else if (!wasPartial && isPartial) {
      this.polling = setInterval(() => {
        dispatch(expandHomeTimeline());
      }, 3000);
    } else if (wasPartial && !isPartial) {
      this._stopPolling();
    }
  }

  _stopPolling () {
    if (this.polling) {
      clearInterval(this.polling);
      this.polling = null;
    }
  }

  handleToggleAnnouncementsClick = (e) => {
    e.stopPropagation();
    this.props.dispatch(toggleShowAnnouncements());
  };

  render () {
    const { intl, hasUnread, columnId, multiColumn, hasAnnouncements, unreadAnnouncements, showAnnouncements, matchesBreakpoint } = this.props;
    const { activeTab } = this.state;
    const pinned = !!columnId;
    const { signedIn } = this.props.identity;
    const banners = [];

    let announcementsButton;

    if (hasAnnouncements) {
      announcementsButton = (
        <button
          type='button'
          className={classNames('column-header__button', { 'active': showAnnouncements })}
          title={intl.formatMessage(showAnnouncements ? messages.hide_announcements : messages.show_announcements)}
          aria-label={intl.formatMessage(showAnnouncements ? messages.hide_announcements : messages.show_announcements)}
          onClick={this.handleToggleAnnouncementsClick}
        >
          <IconWithBadge id='bullhorn' icon={CampaignIcon} count={unreadAnnouncements} />
        </button>
      );
    }

    banners.push(<LiveBanner key='live-banner' />);
    if (criticalUpdatesPending) {
      banners.push(<CriticalUpdateBanner key='critical-update-banner' />);
    }

    const tabConfig = {
      friends: {
        timelineId: 'home',
        onLoadMore: this.handleLoadMoreFriends,
        emptyMessage: <FormattedMessage id='empty_column.home' defaultMessage='Your home timeline is empty! Follow more people to fill it up.' />,
      },
      fof: {
        timelineId: 'public',
        onLoadMore: this.handleLoadMoreFof,
        emptyMessage: <FormattedMessage id='empty_column.public' defaultMessage='There is nothing here! Write something publicly, or manually follow users from other servers to fill it up.' />,
      },
      kommunity: {
        timelineId: 'community',
        onLoadMore: this.handleLoadMoreKommunity,
        emptyMessage: <FormattedMessage id='empty_column.community' defaultMessage='The local timeline is empty. Write something publicly to get the ball rolling!' />,
      },
    };

    const currentTab = tabConfig[activeTab];

    return (
      <Column bindToDocument={!multiColumn} ref={this.setRef} label={intl.formatMessage(messages.title)}>
        <ColumnHeader
          icon='home'
          iconComponent={matchesBreakpoint ? SymbolLogo : HomeIcon}
          active={hasUnread}
          title={intl.formatMessage(messages.title)}
          onPin={this.handlePin}
          onMove={this.handleMove}
          onClick={this.handleHeaderClick}
          pinned={pinned}
          multiColumn={multiColumn}
          extraButton={announcementsButton}
          appendContent={hasAnnouncements && showAnnouncements && <Announcements />}
        >
          <ColumnSettings />
        </ColumnHeader>

        {signedIn && (
          <div className='account__section-headline'>
            <button
              type='button'
              className={classNames({ active: activeTab === 'friends' })}
              onClick={() => this.handleTabChange('friends')}
            >
              {intl.formatMessage(messages.tab_friends)}
            </button>
            <button
              type='button'
              className={classNames({ active: activeTab === 'fof' })}
              onClick={() => this.handleTabChange('fof')}
            >
              {intl.formatMessage(messages.tab_fof)}
            </button>
            <button
              type='button'
              className={classNames({ active: activeTab === 'kommunity' })}
              onClick={() => this.handleTabChange('kommunity')}
            >
              {intl.formatMessage(messages.tab_kommunity)}
            </button>
          </div>
        )}

        {signedIn ? (
          <StatusListContainer
            prepend={activeTab === 'friends' ? banners : []}
            alwaysPrepend={activeTab === 'friends'}
            trackScroll={!pinned}
            scrollKey={`home_timeline-${activeTab}-${columnId}`}
            onLoadMore={currentTab.onLoadMore}
            timelineId={currentTab.timelineId}
            emptyMessage={currentTab.emptyMessage}
            bindToDocument={!multiColumn}
          />
        ) : <NotSignedInIndicator />}

        <Helmet>
          <title>{intl.formatMessage(messages.title)}</title>
          <meta name='robots' content='noindex' />
        </Helmet>
      </Column>
    );
  }

}

export default connect(mapStateToProps)(withBreakpoint(withIdentity(injectIntl(HomeTimeline))));
