import PropTypes from 'prop-types';
import { PureComponent } from 'react';

import { defineMessages, injectIntl, FormattedMessage } from 'react-intl';

import classNames from 'classnames';
import { Helmet } from 'react-helmet';

import { connect } from 'react-redux';
import { Link } from 'react-router-dom';

import CampaignIcon from '@/material-icons/400-24px/campaign.svg?react';
import HomeIcon from '@/material-icons/400-24px/home-fill.svg?react';
import SettingsIcon from '@/material-icons/400-24px/settings.svg?react';
import { SymbolLogo } from 'mastodon/components/logo';
import { fetchAnnouncements, toggleShowAnnouncements } from 'mastodon/actions/announcements';
import { IconWithBadge } from 'mastodon/components/icon_with_badge';
import { NotSignedInIndicator } from 'mastodon/components/not_signed_in_indicator';
import { identityContextPropShape, withIdentity } from 'mastodon/identity_context';
import { criticalUpdatesPending } from 'mastodon/initial_state';
import { withBreakpoint } from 'mastodon/features/ui/hooks/useBreakpoint';
import { MomentsStrip } from 'mastodon/features/moments/home_strip';
import { VeilScene } from 'mastodon/features/inflow/veil_scene';

import { addColumn, removeColumn, moveColumn } from '../../actions/columns';
import { expandFriendsActivity } from '../../actions/friends_activity';
import { expandHomeTimeline, expandCommunityTimeline } from '../../actions/timelines';
import Column from '../../components/column';
import ColumnHeader from '../../components/column_header';
import ScrollableList from '../../components/scrollable_list';
import ActivityItem from '../activity/components/activity_item';
import StatusListContainer from '../ui/containers/status_list_container';

import { ColumnSettings } from './components/column_settings';
import { CriticalUpdateBanner } from './components/critical_update_banner';
import { LiveBanner } from './components/live_banner';
import { Announcements } from './components/announcements';

const messages = defineMessages({
  title: { id: 'column.home', defaultMessage: 'Home' },
  show_announcements: { id: 'home.show_announcements', defaultMessage: 'Show announcements' },
  hide_announcements: { id: 'home.hide_announcements', defaultMessage: 'Hide announcements' },
  feedSettings: { id: 'home.feed_settings', defaultMessage: 'Feed settings' },
  tab_friends: { id: 'home.tab.friends', defaultMessage: 'Friends' },
  tab_fof: { id: 'home.tab.fof', defaultMessage: 'Friends of Friends' },
  tab_kommunity: { id: 'home.tab.kommunity', defaultMessage: '₭ommunity' },
});

const mapStateToProps = state => ({
  hasUnread: state.getIn(['timelines', 'home', 'unread']) > 0,
  isPartial: state.getIn(['timelines', 'home', 'isPartial']),
  hasAnnouncements: !state.getIn(['announcements', 'items']).isEmpty(),
  unreadAnnouncements: state.getIn(['announcements', 'items']).count(item => !item.get('read')),
  showAnnouncements: state.getIn(['announcements', 'show']),
  fofItems: state.friends_activity.get('items'),
  fofIsLoading: state.friends_activity.get('isLoading'),
  fofHasMore: state.friends_activity.get('hasMore'),
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
    fofItems: PropTypes.object,
    fofIsLoading: PropTypes.bool,
    fofHasMore: PropTypes.bool,
  };

  // Which slice of the network the home feed renders. Driven by the
  // user's kronk.feed_scope setting (Friends / FoF / Kommunity),
  // fetched once on mount and cached in state. The old in-header tab
  // picker was retired — this setting is the single source of truth.
  state = {
    activeTab: 'friends',
    initializedTabs: { friends: true, fof: false, kommunity: false },
  };

  loadPersistedFeedScope = async () => {
    try {
      const res = await fetch('/api/v1/kronk_settings', {
        credentials: 'same-origin',
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) return;
      const data = await res.json();
      const scope = data?.feed_scope;
      const tab = scope === 'friends_of_friends' ? 'fof' : scope === 'kommunity' ? 'kommunity' : 'friends';
      if (tab !== this.state.activeTab) this.handleTabChange(tab);
    } catch {
      // Silent — default tab stays.
    }
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
        if (tab === 'fof') dispatch(expandFriendsActivity({}));
        if (tab === 'kommunity') dispatch(expandCommunityTimeline({}));
        return { activeTab: tab, initializedTabs: { ...prev.initializedTabs, [tab]: true } };
      }
      return { activeTab: tab };
    });
  };

  handleLoadMoreFriends = maxId => {
    this.props.dispatch(expandHomeTimeline({ maxId }));
  };

  handleLoadMoreFof = () => {
    const { fofItems, dispatch } = this.props;
    if (!fofItems || fofItems.size === 0) return;
    const lastItem = fofItems.last();
    if (!lastItem) return;
    dispatch(expandFriendsActivity({ maxId: lastItem.get('statusId') }));
  };

  handleLoadMoreKommunity = maxId => {
    this.props.dispatch(expandCommunityTimeline({ maxId }));
  };

  componentDidMount () {
    setTimeout(() => this.props.dispatch(fetchAnnouncements()), 700);
    this._checkIfReloadNeeded(false, this.props.isPartial);
    void this.loadPersistedFeedScope();
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
    const { intl, hasUnread, columnId, multiColumn, hasAnnouncements, unreadAnnouncements, showAnnouncements, matchesBreakpoint, fofItems, fofIsLoading, fofHasMore } = this.props;
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

    const feedSettingsButton = signedIn ? (
      <Link
        to='/home/settings'
        className='column-header__button'
        title={intl.formatMessage(messages.feedSettings)}
        aria-label={intl.formatMessage(messages.feedSettings)}
      >
        <SettingsIcon />
      </Link>
    ) : null;

    const extraButtons = (
      <>
        {announcementsButton}
        {feedSettingsButton}
      </>
    );

    // Moments Home strip — signed-in only. Sits above the daily
    // Kosmic card + LiveBanner per docs/spaces/moments.md § Where you
    // see Moments.
    if (signedIn) {
      banners.push(<MomentsStrip key='moments-strip' />);
    }
    banners.push(<LiveBanner key='live-banner' />);
    if (criticalUpdatesPending) {
      banners.push(<CriticalUpdateBanner key='critical-update-banner' />);
    }

    // The InFlow veil, embedded as a scroll gap in the feed itself (not a
    // tappable card): scroll down and the surface parts to the Kosmos void —
    // tonight's moon + reading — then closes over into your posts. The scene
    // anchors to whatever scrolls around it (the document here), so the same
    // component powers the standalone /hub/inflow page.
    if (signedIn) {
      banners.push(<VeilScene key='inflow-veil' />);
    }

    const statusTabConfig = {
      friends: {
        timelineId: 'home',
        onLoadMore: this.handleLoadMoreFriends,
        emptyMessage: <FormattedMessage id='empty_column.home' defaultMessage='Your home timeline is empty! Follow more people to fill it up.' />,
      },
      kommunity: {
        timelineId: 'community',
        onLoadMore: this.handleLoadMoreKommunity,
        emptyMessage: <FormattedMessage id='empty_column.community' defaultMessage='The local timeline is empty. Write something publicly to get the ball rolling!' />,
      },
    };

    const fofEmptyMessage = <FormattedMessage id='orbit.empty' defaultMessage="Nothing in your orbit yet. When people you follow interact with posts, they'll show up here." />;

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
          extraButton={extraButtons}
          appendContent={hasAnnouncements && showAnnouncements && <Announcements />}
        >
          <ColumnSettings />
        </ColumnHeader>

        {/* Feed scope tabs retired. The friends / friends-of-friends /
            kommunity picker now lives at /home/settings; the home column
            shows one feed driven by that setting. Reachable via the
            settings gear beside Announcements. */}

        {signedIn ? (
          activeTab === 'fof' ? (
            <ScrollableList
              trackScroll={!pinned}
              scrollKey={`home_timeline-fof-${columnId}`}
              hasMore={fofHasMore}
              isLoading={fofIsLoading}
              onLoadMore={this.handleLoadMoreFof}
              emptyMessage={fofEmptyMessage}
              bindToDocument={!multiColumn}
            >
              {fofItems && fofItems.map((item) => {
                const statusId = item.get('statusId');
                const interactions = item.get('interactions');
                return (
                  <ActivityItem
                    key={statusId}
                    statusId={statusId}
                    interactions={interactions}
                  />
                );
              })}
            </ScrollableList>
          ) : (
            <StatusListContainer
              prepend={activeTab === 'friends' ? banners : []}
              alwaysPrepend={activeTab === 'friends'}
              trackScroll={!pinned}
              scrollKey={`home_timeline-${activeTab}-${columnId}`}
              onLoadMore={statusTabConfig[activeTab].onLoadMore}
              timelineId={statusTabConfig[activeTab].timelineId}
              emptyMessage={statusTabConfig[activeTab].emptyMessage}
              bindToDocument={!multiColumn}
            />
          )
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
